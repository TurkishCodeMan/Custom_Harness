import fitz  # PyMuPDF
from PIL import Image
import logging

logger = logging.getLogger(__name__)

def pdf_to_images(file_bytes: bytes):
    """
    Converts PDF bytes to a list of PIL images.
    Each page is rendered at 2x scale for better OCR quality.
    """
    images = []
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)
        doc.close()
    except Exception as e:
        logger.error(f"Error converting PDF to images: {e}")
        raise e
    
    return images
