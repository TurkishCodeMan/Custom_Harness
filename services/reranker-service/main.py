"""
main.py — Qwen3-Reranker Microservice
Provides standard /v1/rerank and /rerank endpoints for cross-encoder reranking.
"""

import os
import re
import logging
from contextlib import asynccontextmanager
from typing import Optional

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("reranker")

# Config
MODEL_NAME = os.getenv("RERANKER_MODEL", "Qwen/Qwen3-Reranker-0.6B")
DEVICE = os.getenv("RERANKER_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
MAX_LENGTH = int(os.getenv("RERANKER_MAX_LENGTH", "8192"))

_YES_TOKEN = "yes"
_NO_TOKEN = "no"

def _build_prompt(tokenizer, query: str, document: str) -> str:
    prefix = "<|im_start|>system\nJudge whether the Document meets the requirements based on the Query and the Candidate Document, output your judgement, the answer should be \"yes\" or \"no\".<|im_end|>\n<|im_start|>user\n"
    suffix = "<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n"
    input_text = f"<Query>{query}</Query>\n<Document>{document}</Document>"
    return prefix + input_text + suffix

tokenizer_global: Optional[AutoTokenizer] = None
model_global: Optional[AutoModelForCausalLM] = None
yes_token_id: Optional[int] = None
no_token_id: Optional[int] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer_global, model_global, yes_token_id, no_token_id

    logger.info("Loading Qwen3-Reranker model: %s on device: %s", MODEL_NAME, DEVICE)
    tokenizer_global = AutoTokenizer.from_pretrained(
        MODEL_NAME,
        padding_side="left",
        trust_remote_code=True,
    )
    model_global = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
        trust_remote_code=True,
    ).to(DEVICE).eval()

    yes_token_id = tokenizer_global.convert_tokens_to_ids(_YES_TOKEN)
    no_token_id = tokenizer_global.convert_tokens_to_ids(_NO_TOKEN)
    logger.info(
        "Reranker model loaded successfully. yes_token_id=%d, no_token_id=%d",
        yes_token_id, no_token_id,
    )
    yield
    logger.info("Shutting down reranker service.")

app = FastAPI(
    title="Custom Harness Qwen3 Reranker Service",
    description="OpenAI / TEI-compatible Qwen3-Reranker-0.6B API",
    version="1.0.0",
    lifespan=lifespan,
)

class RerankRequest(BaseModel):
    query: str
    documents: list[str]
    top_n: Optional[int] = None

class DocumentResult(BaseModel):
    text: str

class RerankResult(BaseModel):
    index: int
    relevance_score: float
    document: DocumentResult

class RerankResponse(BaseModel):
    results: list[RerankResult]

def _score_pair(query: str, document: str) -> float:
    prompt = _build_prompt(tokenizer_global, query, document)
    inputs = tokenizer_global(
        prompt,
        return_tensors="pt",
        max_length=MAX_LENGTH,
        truncation=True,
    ).to(DEVICE)

    with torch.no_grad():
        outputs = model_global(**inputs)

    last_logits = outputs.logits[0, -1, :]
    yes_logit = last_logits[yes_token_id].float()
    no_logit = last_logits[no_token_id].float()
    score = torch.softmax(torch.tensor([yes_logit, no_logit]), dim=0)[0].item()
    return score

def _score_batch(query: str, documents: list[str]) -> list[float]:
    prompts = [_build_prompt(tokenizer_global, query, doc) for doc in documents]
    inputs = tokenizer_global(
        prompts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=MAX_LENGTH,
    ).to(DEVICE)

    with torch.no_grad():
        outputs = model_global(**inputs)

    scores = []
    for i in range(len(prompts)):
        attention = inputs["attention_mask"][i]
        last_idx = attention.sum().item() - 1
        last_logits = outputs.logits[i, int(last_idx), :].float()

        yes_logit = last_logits[yes_token_id]
        no_logit = last_logits[no_token_id]
        score = torch.softmax(torch.tensor([yes_logit, no_logit]), dim=0)[0].item()
        scores.append(score)

    return scores

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "device": DEVICE,
    }

@app.post("/")
@app.post("/v1")
@app.post("/v1/rerank")
@app.post("/rerank")
@app.post("/api/v1/rerank")
async def rerank(req: RerankRequest):
    if model_global is None or tokenizer_global is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")
    if not req.documents:
        return RerankResponse(results=[])

    clean_query = re.sub(r"__user_[a-z_]+__:[^\n]*\n?", "", req.query).strip()
    query = clean_query if clean_query else req.query

    try:
        scores = _score_batch(query, req.documents)
    except Exception as exc:
        logger.error("Batch scoring failed, falling back to single scoring: %s", exc)
        scores = [_score_pair(query, doc) for doc in req.documents]

    indexed = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
    top_n = req.top_n if req.top_n and req.top_n > 0 else len(indexed)

    results = [
        RerankResult(
            index=idx,
            relevance_score=float(score),
            document=DocumentResult(text=req.documents[idx]),
        )
        for idx, score in indexed[:top_n]
    ]

    return RerankResponse(results=results)
