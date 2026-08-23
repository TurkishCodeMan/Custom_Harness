import pandas as pd
import io
import logging

logger = logging.getLogger(__name__)

def excel_to_text(file_bytes: bytes, filename: str) -> str:
    """
    Converts Excel (.xlsx, .xls) or CSV bytes to formatted Markdown table string.
    """
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_bytes))
        else:
            df = pd.read_excel(io.BytesIO(file_bytes))
        
        try:
            content = df.to_markdown(index=False)
        except:
            content = df.to_string(index=False)
            
        return content
    except Exception as e:
        logger.error(f"Error parsing Excel/CSV: {e}")
        raise e
