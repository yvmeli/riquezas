"""Exact financial calculations. Never combine currencies or count transfers as income."""
from collections import defaultdict
from decimal import Decimal


def summarize(accounts, transactions, start, end, currency, account_id=None, institution=None, category=None):
    selected = {a['id']: a for a in accounts if a['currency'] == currency
                and (not account_id or a['id'] == account_id)
                and (not institution or a['institution'] == institution)}
    balances = {k: Decimal(str(v['opening_balance'])) for k, v in selected.items()}
    income = expense = Decimal('0')
    categories = defaultdict(Decimal)
    monthly = defaultdict(lambda: {'income': Decimal('0'), 'expense': Decimal('0')})
    recent = []
    for tx in transactions:
        source = tx['account_id'] in selected
        destination = tx.get('destination_account_id') in selected
        amount = Decimal(str(tx['amount']))
        day = tx['occurred_on']
        if day <= end:
            if source:
                balances[tx['account_id']] += amount if tx['kind'] == 'income' else -amount
            if destination:
                balances[tx['destination_account_id']] += amount
        if not (start <= day <= end) or not (source or destination) or (category and tx['category'] != category):
            continue
        recent.append(tx)
        if tx['kind'] == 'income' and source:
            income += amount
            monthly[day[:7]]['income'] += amount
        elif tx['kind'] == 'expense' and source:
            expense += amount
            monthly[day[:7]]['expense'] += amount
            categories[tx['category']] += amount
    # Credit opening balance is signed: debt is negative, credit in favor is positive.
    return {'currency': currency, 'income': str(income), 'expense': str(expense),
            'net': str(income - expense), 'recorded_balance': str(sum(balances.values(), Decimal('0'))),
            'balances': {k: str(v) for k, v in balances.items()},
            'categories': [{'name': k, 'amount': str(v)} for k, v in sorted(categories.items())],
            'monthly': [{'month': k, **{key: str(value) for key, value in v.items()}} for k, v in sorted(monthly.items())],
            'recent': sorted(recent, key=lambda t: (t['occurred_on'], t['id']), reverse=True)[:20]}
