"""Bank adapters fail closed until real formats have independent evidence."""
from dataclasses import dataclass
from .types import UnsupportedFormat


@dataclass(frozen=True)
class BankAdapter:
    institution: str
    verified_pdf: bool = False
    verified_email: bool = False

    def parse_statement(self, text: str):
        raise UnsupportedFormat(f'El formato PDF de {self.institution} requiere muestras verificables. No se generaron movimientos.')

    def parse_notification(self, text: str):
        raise UnsupportedFormat(f'El formato de correo de {self.institution} requiere muestras verificables. No se generaron movimientos.')


QIK = BankAdapter('qik')
POPULAR = BankAdapter('popular')
ADAPTERS = {'qik': QIK, 'popular': POPULAR}
