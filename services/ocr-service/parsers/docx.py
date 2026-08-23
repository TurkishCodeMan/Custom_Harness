from docx import Document
import io
import logging

logger = logging.getLogger(__name__)

def docx_to_text(file_bytes: bytes) -> str:
    """
    Extracts text from a DOCX file while preserving paragraph structure.
    """
    try:
        doc = Document(io.BytesIO(file_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        return '\n\n'.join(full_text)
    except Exception as e:
        logger.error(f"Error parsing DOCX: {e}")
        raise e
