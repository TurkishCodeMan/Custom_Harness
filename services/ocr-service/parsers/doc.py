import subprocess
import tempfile
import os
import logging
from .docx import docx_to_text

logger = logging.getLogger(__name__)

def doc_to_text(file_bytes: bytes) -> str:
    """
    Extracts text from a legacy .doc file using antiword or falls back to docx_to_text if ZIP header.
    """
    if file_bytes.startswith(b'PK\x03\x04'):
        return docx_to_text(file_bytes)
        
    with tempfile.NamedTemporaryFile(suffix=".doc", delete=False) as f:
        f.write(file_bytes)
        temp_path = f.name
        
    try:
        result = subprocess.run(['antiword', temp_path], capture_output=True, text=True, check=True)
        return result.stdout
    except Exception as e:
        logger.warning(f"Antiword parsing failed or not installed: {e}")
        return ""
    finally:
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
