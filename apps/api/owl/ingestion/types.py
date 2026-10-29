from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Candidate(BaseModel):
    model_config = ConfigDict(extra='forbid', frozen=True)
    occurred_on: date
    description: str = Field(min_length=1, max_length=240)
    amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    currency: Literal['DOP', 'USD']
    kind: Literal['income', 'expense']
    source: Literal['gmail', 'pdf']
    source_key: str = Field(min_length=1, max_length=240)
    institution: Literal['qik', 'popular']
    reference: str | None = None
    reference_verified: bool = False
    needs_review: bool = True


class UnsupportedFormat(ValueError):
    """Input does not supply enough verified evidence; never invent financial data."""
