from dataclasses import dataclass
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses
from html.parser import HTMLParser
import re

from .types import UnsupportedFormat

MAX_MESSAGE_BYTES = 2 * 1024 * 1024
MAX_PARTS = 150
MAX_TEXT_CHARACTERS = 200000


class VisibleHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'head'):
            self.hidden += 1
        elif not self.hidden and tag in ('br','p','div','tr','td','li','table'):
            self.parts.append('\n' if tag != 'td' else ' ')

    def handle_endtag(self, tag):
        if tag in ('script','style','head') and self.hidden:
            self.hidden -= 1

    def handle_data(self, value):
        if not self.hidden:
            self.parts.append(value)


def html_text(value: str) -> str:
    parser = VisibleHTML()
    parser.feed(value)
    return '\n'.join(re.sub(r'[ \t]+', ' ', line).strip() for line in ''.join(parser.parts).splitlines() if line.strip())


@dataclass(frozen=True)
class MessageContent:
    message: EmailMessage
    text: str
    contains_nested_message: bool


def read_mime(raw: bytes) -> MessageContent:
    if len(raw) > MAX_MESSAGE_BYTES:
        raise UnsupportedFormat('El mensaje supera el límite de tamaño.')
    try:
        message = BytesParser(policy=policy.default).parsebytes(raw)
    except (RecursionError, ValueError):
        raise UnsupportedFormat('El mensaje no tiene una estructura MIME válida.') from None
    count = 0
    nested = False

    def visit(part, depth=0):
        nonlocal count, nested
        count += 1
        if count > MAX_PARTS or depth > 15:
            raise UnsupportedFormat('El mensaje contiene demasiadas partes o niveles.')
        if part.get_content_type() == 'message/rfc822':
            nested = True
        if part.is_multipart():
            # Prefer one representation; processing plain+HTML would duplicate rows.
            children = list(part.iter_parts())
            if part.get_content_subtype() == 'alternative':
                for content_type in ('text/plain', 'text/html'):
                    preferred = [child for child in children if child.get_content_type() == content_type]
                    if preferred:
                        text = visit(preferred[0], depth + 1)
                        if text.strip():
                            return text
                return ''
            return '\n'.join(visit(child, depth + 1) for child in children)
        if part.get_filename() or part.get_content_disposition() == 'attachment':
            return ''
        if part.get_content_type() not in ('text/plain', 'text/html'):
            return ''
        try:
            text = part.get_content()
        except (LookupError, UnicodeError, ValueError):
            raise UnsupportedFormat('No se pudo interpretar la codificación del mensaje.') from None
        if not isinstance(text, str):
            return ''
        return html_text(text) if part.get_content_type() == 'text/html' else text

    try:
        text = visit(message)
    except RecursionError:
        raise UnsupportedFormat('El mensaje contiene demasiados niveles.') from None
    if len(text) > MAX_TEXT_CHARACTERS:
        raise UnsupportedFormat('El texto del mensaje supera el límite permitido.')
    return MessageContent(message, text.strip(), nested)


def sender_evidence(message: EmailMessage, institution: str, *, trusted_gmail_transport=False,
                    popular_senders: frozenset[str] = frozenset()) -> bool:
    """Only evaluate auth headers obtained through the user's Gmail API connection.

    An uploaded EML with invented Authentication-Results is never trusted. This
    evidence still does not certify the body format, product, amount or balance.
    """
    if not trusted_gmail_transport:
        return False
    from_headers = message.get_all('From', [])
    authentication = message.get_all('Authentication-Results', [])
    if len(from_headers) != 1 or len(authentication) != 1:
        return False
    addresses = getaddresses([str(from_headers[0])])
    if len(addresses) != 1:
        return False
    sender = addresses[0][1].lower()
    allowed = {'notificaciones@qik.do'} if institution == 'qik' else popular_senders if institution == 'popular' else set()
    if sender not in allowed:
        return False
    domain = sender.rpartition('@')[2]
    evidence = str(authentication[0]).lower()
    if evidence.split(';', 1)[0].strip() != 'mx.google.com':
        return False
    clauses = [re.sub(r'\([^)]*\)', '', clause).strip() for clause in evidence.split(';')[1:]]
    dkim = any(re.match(r'^dkim=pass\b', clause) and
               re.search(r'\bheader\.d=(?:[a-z0-9-]+\.)*' + re.escape(domain) + r'(?:\s|$)', clause) for clause in clauses)
    dmarc = any(re.match(r'^dmarc=pass\b', clause) and
                re.search(r'\bheader\.from=' + re.escape(domain) + r'(?:\s|$)', clause) for clause in clauses)
    return dkim and dmarc
