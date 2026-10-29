from decimal import Decimal
from owl.finance import summarize

ACCOUNTS = [
    {'id':'debit','currency':'DOP','kind':'debit','opening_balance':'10000.00','institution':'qik'},
    {'id':'card','currency':'DOP','kind':'credit','opening_balance':'-2000.00','institution':'popular'},
    {'id':'usd','currency':'USD','kind':'savings','opening_balance':'50.00','institution':'other'},
]


def tx(identifier, account, kind, amount, destination=None, day='2026-10-20', category='Otros'):
    return {'id':identifier,'account_id':account,'kind':kind,'amount':amount,'destination_account_id':destination,
            'occurred_on':day,'category':category,'description':'Sintético','source':'manual'}


def summary(rows, **kwargs):
    return summarize(ACCOUNTS,rows,'2026-10-01','2026-10-31','DOP',**kwargs)


def test_card_payment_and_internal_transfer_do_not_inflate_income_or_expense():
    result=summary([tx('1','debit','transfer','1000.00','card')])
    assert result['income']==result['expense']=='0'
    assert result['balances']=={'debit':'9000.00','card':'-1000.00'}
    assert result['recorded_balance']=='8000.00'


def test_purchase_and_salary_count_once_and_debt_is_not_available_credit():
    result=summary([tx('1','debit','income','100.10'),tx('2','card','expense','50.05'),tx('3','debit','transfer','50.05','card')])
    assert result['net']=='50.05'
    assert result['recorded_balance']=='8050.05'


def test_many_decimal_movements_remain_exact():
    result=summary([tx(str(i),'debit','expense','0.01') for i in range(1000)])
    assert Decimal(result['expense'])==Decimal('10.00')


def test_currencies_never_mix():
    result=summary([tx('1','usd','income','9999.99')])
    assert result['income']=='0'
    assert 'usd' not in result['balances']


def test_period_flow_excludes_older_and_future_but_balance_includes_older():
    rows=[tx('1','debit','income','25',day='2026-09-01'),tx('2','debit','income','100',day='2026-11-01')]
    result=summary(rows)
    assert result['income']=='0'
    assert result['recorded_balance']=='8025.00'


def test_destination_account_filter_preserves_transfer_effect():
    result=summary([tx('1','debit','transfer','1000','card')],account_id='card')
    assert result['recorded_balance']=='-1000.00'
    assert len(result['recent'])==1


def test_category_and_bank_filters_apply_to_flows_without_changing_balance():
    rows=[tx('1','debit','expense','10',category='Hogar'),tx('2','debit','expense','20',category='Salud')]
    result=summary(rows,institution='qik',category='Hogar')
    assert result['expense']=='10'
    assert result['recorded_balance']=='9970.00'
    assert result['categories']==[{'name':'Hogar','amount':'10'}]
