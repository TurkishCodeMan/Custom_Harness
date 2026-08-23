import logging
import uuid
import base64
import torch
import psycopg2
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from transformers import AutoProcessor, AutoModel
import numpy as np
from config import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Config
MODEL_NAME = config.MODEL_NAME

class GlobalState:
    processor = None
    model = None
    device = "cpu"

def get_db_connection():
    return psycopg2.connect(
        host=config.POSTGRES_HOST,
        port=config.POSTGRES_PORT,
        dbname=config.POSTGRES_DB,
        user=config.POSTGRES_USER,
        password=config.POSTGRES_PASSWORD
    )

def init_db():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS image_vectors (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        filepath TEXT UNIQUE NOT NULL,
                        embedding vector(768),
                        ocr_text TEXT
                    );
                """)
            conn.commit()
        logger.info("Database initialized with pgvector and image_vectors table.")
    except Exception as e:
        logger.error(f"Error initializing DB: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB
    init_db()
    
    # Load Model
    logger.info(f"Loading SigLIP model: {MODEL_NAME}")
    GlobalState.device = "cuda" if torch.cuda.is_available() else "cpu"
    GlobalState.processor = AutoProcessor.from_pretrained(MODEL_NAME)
    GlobalState.model = AutoModel.from_pretrained(MODEL_NAME).to(GlobalState.device)
    GlobalState.model.eval()
    logger.info(f"SigLIP Model loaded successfully on {GlobalState.device}.")
    
    yield
    
    logger.info("Shutting down image-search-service")

app = FastAPI(title="Image Search Service (SigLIP 2)", lifespan=lifespan)

class EmbedImageRequest(BaseModel):
    image_base64: str

class EmbedTextRequest(BaseModel):
    text: str

class IndexRequest(BaseModel):
    filepath: str
    image_base64: str
    ocr_text: str | None = None

class SearchRequest(BaseModel):
    image_base64: str
    ocr_text: str | None = None
    top_k: int = 5

class SearchTextRequest(BaseModel):
    query: str
    top_k: int = 5

class DeleteRequest(BaseModel):
    filepath: str

def safe_b64decode(b64string: str):
    b64string += "=" * (-len(b64string) % 4)
    return base64.b64decode(b64string)

def extract_embedding(image_bytes: bytes) -> np.ndarray:
    import io
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    with torch.no_grad():
        inputs = GlobalState.processor(images=image, return_tensors="pt").to(GlobalState.device)
        out = GlobalState.model.get_image_features(**inputs)
        
        if hasattr(out, "pooler_output") and out.pooler_output is not None:
            image_features = out.pooler_output
        elif hasattr(out, "image_embeds"):
            image_features = out.image_embeds
        else:
            image_features = out

        # Normalize
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    
    return image_features.cpu().numpy()[0]

def extract_text_embedding(text: str) -> np.ndarray:
    with torch.no_grad():
        inputs = GlobalState.processor(text=[text], return_tensors="pt", padding="max_length").to(GlobalState.device)
        out = GlobalState.model.get_text_features(**inputs)
        
        if hasattr(out, "pooler_output") and out.pooler_output is not None:
            text_features = out.pooler_output
        elif hasattr(out, "text_embeds"):
            text_features = out.text_embeds
        else:
            text_features = out
            
        # Normalize
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
    
    return text_features.cpu().numpy()[0]

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "device": GlobalState.device}

@app.post("/api/v1/embed/image")
async def embed_image_endpoint(req: EmbedImageRequest):
    try:
        image_bytes = safe_b64decode(req.image_base64)
        embedding = extract_embedding(image_bytes)
        return {"status": "success", "embedding": embedding.tolist()}
    except Exception as e:
        logger.error(f"Error extracting image embedding: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/embed/text")
async def embed_text_endpoint(req: EmbedTextRequest):
    try:
        embedding = extract_text_embedding(req.text)
        return {"status": "success", "embedding": embedding.tolist()}
    except Exception as e:
        logger.error(f"Error extracting text embedding: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/index")
async def index_image(req: IndexRequest):
    try:
        image_bytes = safe_b64decode(req.image_base64)
        embedding = extract_embedding(image_bytes)
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO image_vectors (filepath, embedding, ocr_text)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (filepath) DO UPDATE 
                    SET embedding = EXCLUDED.embedding, ocr_text = EXCLUDED.ocr_text;
                """, (req.filepath, embedding.tolist(), req.ocr_text))
            conn.commit()
            
        logger.info(f"Successfully indexed {req.filepath}")
        return {"status": "success", "filepath": req.filepath}
    except Exception as e:
        logger.error(f"Error indexing image {req.filepath}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/search")
async def search_image(req: SearchRequest):
    try:
        image_bytes = safe_b64decode(req.image_base64)
        embedding = extract_embedding(image_bytes)
        
        results = []
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if req.ocr_text and req.ocr_text.strip():
                    cur.execute("""
                        WITH visual_ranks AS (
                            SELECT filepath, ocr_text, 1 - (embedding <=> %s::vector) AS similarity,
                                   ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector) as rank
                            FROM image_vectors
                        ),
                        text_ranks AS (
                            SELECT filepath, 
                                    ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('simple', COALESCE(ocr_text, '')), plainto_tsquery('simple', %s)) DESC) as rank
                            FROM image_vectors
                            WHERE to_tsvector('simple', COALESCE(ocr_text, '')) @@ plainto_tsquery('simple', %s)
                        )
                        SELECT v.filepath, v.similarity, v.ocr_text,
                               COALESCE(1.0 / (60 + v.rank), 0.0) + COALESCE(1.0 / (60 + t.rank), 0.0) AS rrf_score
                        FROM visual_ranks v
                        LEFT JOIN text_ranks t ON v.filepath = t.filepath
                        ORDER BY rrf_score DESC
                        LIMIT %s;
                    """, (embedding.tolist(), embedding.tolist(), req.ocr_text, req.ocr_text, req.top_k))
                else:
                    cur.execute("""
                        SELECT filepath, 1 - (embedding <=> %s::vector) AS similarity, ocr_text
                        FROM image_vectors
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s;
                    """, (embedding.tolist(), embedding.tolist(), req.top_k))
                
                rows = cur.fetchall()
                for row in rows:
                    results.append({"filepath": row[0], "similarity": float(row[1]), "ocr_text": row[2] or ""})
                    
        return {"status": "success", "results": results}
    except Exception as e:
        logger.error(f"Error searching image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/search_text")
async def search_image_by_text(req: SearchTextRequest):
    try:
        embedding = extract_text_embedding(req.query)
        
        results = []
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if req.query and req.query.strip():
                    cur.execute("""
                        WITH visual_ranks AS (
                            SELECT filepath, ocr_text, 1 - (embedding <=> %s::vector) AS similarity,
                                   ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector) as rank
                            FROM image_vectors
                        ),
                        text_ranks AS (
                            SELECT filepath, 
                                   ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('simple', COALESCE(ocr_text, '')), plainto_tsquery('simple', %s)) DESC) as rank
                            FROM image_vectors
                            WHERE to_tsvector('simple', COALESCE(ocr_text, '')) @@ plainto_tsquery('simple', %s)
                        )
                        SELECT v.filepath, v.similarity, v.ocr_text,
                               COALESCE(1.0 / (60 + v.rank), 0.0) + COALESCE(1.0 / (60 + t.rank), 0.0) AS rrf_score
                        FROM visual_ranks v
                        LEFT JOIN text_ranks t ON v.filepath = t.filepath
                        ORDER BY rrf_score DESC
                        LIMIT %s;
                    """, (embedding.tolist(), embedding.tolist(), req.query, req.query, req.top_k))
                else:
                    cur.execute("""
                        SELECT filepath, 1 - (embedding <=> %s::vector) AS similarity, ocr_text
                        FROM image_vectors
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s;
                    """, (embedding.tolist(), embedding.tolist(), req.top_k))
                
                rows = cur.fetchall()
                for row in rows:
                    results.append({"filepath": row[0], "similarity": float(row[1]), "ocr_text": row[2] or ""})
                    
        return {"status": "success", "results": results}
    except Exception as e:
        logger.error(f"Error searching image by text: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/delete")
async def delete_image(req: DeleteRequest):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM image_vectors WHERE filepath = %s;", (req.filepath,))
            conn.commit()
            
        logger.info(f"Successfully deleted vector for {req.filepath}")
        return {"status": "success", "filepath": req.filepath}
    except Exception as e:
        logger.error(f"Error deleting image {req.filepath}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
