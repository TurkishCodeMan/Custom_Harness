import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MODEL_ID: str = os.getenv("OCR_MODEL_ID", "zai-org/GLM-OCR")
    DEVICE: str = os.getenv("OCR_DEVICE", "cuda:0")
    MAX_NEW_TOKENS: int = int(os.getenv("OCR_MAX_NEW_TOKENS", "8192"))
    TORCH_DTYPE: str = os.getenv("OCR_TORCH_DTYPE", "bfloat16")
    
    model_config = SettingsConfigDict(extra="ignore")

settings = Settings()

MODEL_ID = settings.MODEL_ID
DEVICE = settings.DEVICE
MAX_NEW_TOKENS = settings.MAX_NEW_TOKENS
TORCH_DTYPE = settings.TORCH_DTYPE
