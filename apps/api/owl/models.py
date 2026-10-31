from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator, model_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


Money = Decimal


class Credentials(Model):
    email: EmailStr
    password: Annotated[str, StringConstraints(strip_whitespace=False, min_length=12, max_length=128)]


class Login(Model):
    email: EmailStr
    password: Annotated[str, StringConstraints(strip_whitespace=False, min_length=1, max_length=128)]


class Registration(Credentials):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone: str = Field(default="", max_length=30)
    accepted_terms: Literal[True]


class Email(Model):
    email: EmailStr


class Verify(Email):
    code: str = Field(pattern=r"^\d{6,10}$")
    kind: Literal["signup", "recovery", "email"] = "signup"


class InvitationCreate(Email):
    role: Literal['client', 'support', 'operator', 'owner']


class InvitationAccept(Model):
    accepted_terms: Literal[True]


class LinkSession(Model):
    token_hash: str = Field(min_length=32, max_length=256, pattern=r'^[A-Za-z0-9_-]+$')


class InvitationSession(LinkSession):
    invitation_id: UUID


class UserAccess(Model):
    disabled: bool


class Password(Model):
    password: Annotated[str, StringConstraints(strip_whitespace=False, min_length=12, max_length=128)]


class Appointment(Model):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=30)
    modality: Literal["whatsapp", "video", "in_person"]
    preferred_at: datetime
    consent: Literal[True]


class Onboarding(Model):
    template: Literal["basic", "budget", "saving"]
    methods: list[Literal["manual", "pdf", "gmail"]] = Field(min_length=1, max_length=3)


class Account(Model):
    name: str = Field(min_length=1, max_length=80)
    institution: Literal["qik", "popular", "other"] = "other"
    kind: Literal["debit", "savings", "credit"]
    currency: Literal["DOP", "USD"]
    opening_balance: Money = Field(default=Decimal("0"), max_digits=16, decimal_places=2)
    last_four: str | None = Field(default=None, pattern=r"^\d{4}$")


class Transaction(Model):
    account_id: UUID
    destination_account_id: UUID | None = None
    kind: Literal["income", "expense", "transfer"]
    amount: Money = Field(gt=0, max_digits=16, decimal_places=2)
    occurred_on: date
    description: str = Field(min_length=1, max_length=240)
    category: str = Field(default="Sin categoría", min_length=1, max_length=60)
    idempotency_key: UUID

    @model_validator(mode="after")
    def transfer(self):
        if (self.kind == "transfer") != (self.destination_account_id is not None):
            raise ValueError("Las transferencias requieren una cuenta destino.")
        if self.account_id == self.destination_account_id:
            raise ValueError("La cuenta destino debe ser diferente.")
        return self


class Reclassify(Model):
    category: str = Field(min_length=1, max_length=60)


class Budget(Model):
    month: date
    category: str = Field(min_length=1, max_length=60)
    currency: Literal["DOP", "USD"]
    amount: Money = Field(gt=0, max_digits=16, decimal_places=2)

    @field_validator("month")
    @classmethod
    def first_day(cls, value):
        if value.day != 1:
            raise ValueError("Usa el primer día del mes.")
        return value


class Goal(Model):
    name: str = Field(min_length=1, max_length=100)
    currency: Literal["DOP", "USD"]
    target_amount: Money = Field(gt=0, max_digits=16, decimal_places=2)
    target_date: date


class Contribution(Model):
    amount: Money = Field(gt=0, max_digits=16, decimal_places=2)
    idempotency_key: UUID


class TrialExtension(Model):
    user_id: UUID
    days: int = Field(ge=1, le=365)
    reason: str = Field(min_length=5, max_length=240)


class AppointmentUpdate(Model):
    status: Literal["confirmed", "rescheduled", "cancelled", "closed"]
    scheduled_at: datetime | None = None
    outcome: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def require_schedule(self):
        if self.status in ("confirmed", "rescheduled") and self.scheduled_at is None:
            raise ValueError("Debes indicar la fecha acordada.")
        return self
