import io
import os
import asyncio
import base64
import logging
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import httpx
from PIL import Image

import config
from parsers import pdf_to_images, excel_to_text, docx_to_text, doc_to_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ocr-service")

MODEL_ID = config.MODEL_ID
DEVICE = config.DEVICE

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting OCR Service with model: {MODEL_ID} on {DEVICE}")
    yield
    logger.info("Shutting down OCR Service.")

app = FastAPI(title="Custom Harness Document & OCR Microservice", lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_ID, "device": DEVICE}

async def process_image_with_vllm(client: httpx.AsyncClient, image_bytes: bytes, vllm_url: str, prompt: str = "Text Recognition:") -> str:
    b64_img = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "model": MODEL_ID,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}},
                    {"type": "text", "text": prompt}
                ]
            }
        ],
        "max_tokens": config.MAX_NEW_TOKENS
    }
    
    resp = await client.post(f"{vllm_url}/v1/chat/completions", json=payload, timeout=300.0)
    if resp.status_code == 200:
        return resp.json()["choices"][0]["message"]["content"]
    raise HTTPException(status_code=resp.status_code, detail=resp.text)

@app.api_route("/process", methods=["POST", "PUT"])
async def process_document(request: Request):
    try:
        content_type = request.headers.get("content-type", "")
        filename = request.headers.get("x-filename") or "document.pdf"
        filename_lower = filename.lower()
        
        file_bytes: Optional[bytes] = None

        if "multipart/form-data" in content_type:
            form = await request.form()
            for key, value in form.items():
                if isinstance(value, UploadFile) or hasattr(value, "file"):
                    file_bytes = await value.read()
                    if hasattr(value, "filename") and value.filename:
                        filename_lower = value.filename.lower()
                    break
        else:
            file_bytes = await request.body()

        if not file_bytes:
            raise HTTPException(status_code=400, detail="No file payload received.")

        logger.info(f"Processing document: {filename_lower} ({len(file_bytes)} bytes)")

        # 1. Excel / CSV Parsing
        if filename_lower.endswith(('.xlsx', '.xls', '.csv')):
            text = excel_to_text(file_bytes, filename_lower)
            return JSONResponse(content=[{"page_content": text, "metadata": {"filename": filename_lower, "type": "spreadsheet"}}])

        # 2. Word (DOCX / DOC) Parsing
        if filename_lower.endswith('.docx'):
            text = docx_to_text(file_bytes)
            return JSONResponse(content=[{"page_content": text, "metadata": {"filename": filename_lower, "type": "word"}}])

        if filename_lower.endswith('.doc'):
            text = doc_to_text(file_bytes)
            return JSONResponse(content=[{"page_content": text, "metadata": {"filename": filename_lower, "type": "word-legacy"}}])

        # 3. PDF & Image Processing with OCR
        images = []
        if filename_lower.endswith('.pdf'):
            images = pdf_to_images(file_bytes)
        elif filename_lower.endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff')):
            images = [Image.open(io.BytesIO(file_bytes)).convert("RGB")]
        else:
            # Fallback text decoding
            try:
                text = file_bytes.decode('utf-8')
                return JSONResponse(content=[{"page_content": text, "metadata": {"filename": filename_lower, "type": "text"}}])
            except:
                raise HTTPException(status_code=400, detail=f"Unsupported file format: {filename_lower}")

        # Process pages
        vllm_internal_url = os.getenv("VLLM_OCR_URL", "http://127.0.0.1:8000")
        results = []
        
        async with httpx.AsyncClient() as client:
            for idx, img in enumerate(images):
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=90)
                img_bytes = buf.getvalue()
                
                try:
                    page_text = await process_image_with_vllm(client, img_bytes, vllm_internal_url)
                except Exception as e:
                    logger.warning(f"Direct vLLM call failed for page {idx+1}: {e}")
                    page_text = f"[OCR Failed for Page {idx+1}]"

                results.append({
                    "page_content": page_text,
                    "metadata": {"page": idx + 1, "total_pages": len(images), "filename": filename_lower}
                })

        return JSONResponse(content=results)

    except Exception as e:
        logger.error(f"Error processing document: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
