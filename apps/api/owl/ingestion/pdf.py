"""Conservative extraction, without assuming a bank's columns or balances."""
from dataclasses import dataclass
from hashlib import sha256
from io import BytesIO
import logging
from pypdf import PdfReader
from .types import UnsupportedFormat

MAX_PDF_BYTES = 8 * 1024 * 1024
MAX_PAGES = 30
MAX_CHARACTERS = 200000


@dataclass(frozen=True)
class PDFText:
    digest: str
    pages: tuple[str, ...]
    requires_ocr: bool


def extract_pdf(data: bytes) -> PDFText:
    """Run in a bounded worker before exposing an upload endpoint publicly.

    Current function is internal and has no HTTP upload endpoint. File bytes and
    extracted text remain in caller memory; no document is persisted or logged.
    """
    if not data.startswith(b'%PDF-') or not data or len(data) > MAX_PDF_BYTES:
        raise UnsupportedFormat('Archivo inválido o PDF mayor de 8 MB.')
    # Do not let parser warning messages leak file content into application logs.
    logger = logging.getLogger('pypdf')
    previous = logger.disabled
    logger.disabled = True
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise UnsupportedFormat('Los PDF cifrados requieren una copia sin contraseña.')
        root = reader.trailer['/Root']
        if any(key in root for key in ('/OpenAction', '/AA')):
            raise UnsupportedFormat('El documento contiene acciones activas no admitidas.')
        names = root.get('/Names', {})
        if hasattr(names, 'get_object'):
            names = names.get_object()
        if any(key in names for key in ('/JavaScript', '/EmbeddedFiles')):
            raise UnsupportedFormat('El documento contiene scripts o archivos adjuntos.')
        if len(reader.pages) > MAX_PAGES:
            raise UnsupportedFormat('El documento supera las 30 páginas.')
        pages = []
        characters = 0
        for page in reader.pages:
            text = page.extract_text() or ''
            characters += len(text)
            if characters > MAX_CHARACTERS:
                raise UnsupportedFormat('El documento contiene demasiado texto.')
            pages.append(text)
        if not pages:
            raise UnsupportedFormat('El documento no contiene páginas.')
        return PDFText(sha256(data).hexdigest(), tuple(pages), not any(p.strip() for p in pages))
    except UnsupportedFormat:
        raise
    except Exception:
        raise UnsupportedFormat('No se pudo leer el PDF. Revisa el archivo original.') from None
    finally:
        logger.disabled = previous
