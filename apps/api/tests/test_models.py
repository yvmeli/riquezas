from uuid import uuid4
import pytest
from pydantic import ValidationError
from owl.models import Transaction, Account, Budget, AppointmentUpdate


@pytest.mark.parametrize('amount',['0','-1','0.001','NaN','Infinity','100000000000000.00'])
def test_reject_invalid_amounts(amount):
    with pytest.raises(ValidationError):
        Transaction(account_id=uuid4(),kind='expense',amount=amount,occurred_on='2026-10-28',description='Prueba',idempotency_key=uuid4())


def test_transfer_requires_distinct_destination():
    identifier=uuid4()
    for destination in (None,identifier):
        with pytest.raises(ValidationError):
            Transaction(account_id=identifier,destination_account_id=destination,kind='transfer',amount='1',occurred_on='2026-10-28',description='Prueba',idempotency_key=uuid4())


def test_non_transfer_cannot_have_destination():
    with pytest.raises(ValidationError):
        Transaction(account_id=uuid4(),destination_account_id=uuid4(),kind='expense',amount='1',occurred_on='2026-10-28',description='Prueba',idempotency_key=uuid4())


def test_full_card_number_rejected():
    with pytest.raises(ValidationError):
        Account(name='Prueba',kind='credit',currency='DOP',last_four='0000000000000000')


def test_budget_month_requires_first_day():
    with pytest.raises(ValidationError):
        Budget(month='2026-10-28',category='Otros',currency='DOP',amount='10')


def test_confirmed_appointment_requires_agreed_schedule():
    with pytest.raises(ValidationError):
        AppointmentUpdate(status='confirmed')


def test_password_whitespace_is_not_silently_modified():
    from owl.models import Login, Password
    value='  synthetic password  '
    assert Login(email='synthetic@example.com',password=value).password==value
    assert Password(password=value).password==value
