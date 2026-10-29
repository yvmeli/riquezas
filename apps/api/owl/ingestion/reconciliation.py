from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import re
import unicodedata
from .types import Candidate


@dataclass(frozen=True)
class ExistingMovement:
    id: str
    user_id: str
    account_id: str
    occurred_on: date
    description: str
    amount: Decimal
    currency: str
    kind: str
    source: str
    source_key: str
    reference: str | None = None
    reference_verified: bool = False


@dataclass(frozen=True)
class Decision:
    status: str
    matching_ids: tuple[str, ...] = ()


def normalized_description(value: str) -> str:
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value).casefold()).strip()


def reconcile(candidate: Candidate, existing: list[ExistingMovement], *, user_id: str, account_id: str) -> Decision:
    scoped = [row for row in existing if row.user_id == user_id and row.account_id == account_id]
    exact_source = [row for row in scoped if row.source == candidate.source and row.source_key == candidate.source_key]
    if exact_source:
        identical = [row for row in exact_source if row.amount == candidate.amount and row.currency == candidate.currency
                     and row.kind == candidate.kind and row.occurred_on == candidate.occurred_on
                     and normalized_description(row.description) == normalized_description(candidate.description)]
        return Decision('duplicate' if len(identical) == len(exact_source) else 'source_conflict', tuple(row.id for row in exact_source))
    referenced = [row for row in scoped if candidate.reference and candidate.reference_verified and row.reference_verified
                  and row.reference == candidate.reference and row.currency == candidate.currency]
    if referenced:
        exact = [row for row in referenced if row.amount == candidate.amount and row.kind == candidate.kind and row.occurred_on == candidate.occurred_on]
        return Decision('duplicate' if len(exact) == 1 and len(referenced) == 1 else 'needs_review', tuple(row.id for row in referenced))
    possible = [row for row in scoped if row.amount == candidate.amount and row.currency == candidate.currency
                and row.kind == candidate.kind and row.occurred_on == candidate.occurred_on
                and normalized_description(row.description) == normalized_description(candidate.description)]
    if possible:
        # Two identical purchases on the same day can both be legitimate.
        return Decision('possible_duplicate', tuple(row.id for row in possible))
    return Decision('needs_review' if candidate.needs_review else 'new')


def associate_reversal(candidate: Candidate, existing: list[ExistingMovement], *, original_reference: str,
                       user_id: str, account_id: str) -> Decision:
    if not candidate.reference_verified or not original_reference:
        return Decision('needs_review')
    matches = [row for row in existing if row.user_id == user_id and row.account_id == account_id
               and row.reference_verified and row.reference == original_reference
               and row.currency == candidate.currency and row.amount == candidate.amount
               and row.kind != candidate.kind and row.kind in ('income','expense')
               and row.occurred_on <= candidate.occurred_on]
    return Decision('reversal_link' if len(matches) == 1 else 'needs_review', tuple(row.id for row in matches))
