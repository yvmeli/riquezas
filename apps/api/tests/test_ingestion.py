from datetime import date
from decimal import Decimal
from email.message import EmailMessage
from io import BytesIO
from dataclasses import replace
import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from owl.ingestion.adapters import ADAPTERS
from owl.ingestion.mime import read_mime, sender_evidence
from owl.ingestion.pdf import extract_pdf
from owl.ingestion.reconciliation import ExistingMovement, associate_reversal, reconcile
from owl.ingestion.types import Candidate, UnsupportedFormat


def pdf(text='Documento sintético sin transacciones', pages=1, encrypted=False):
    writer=PdfWriter()
    for _ in range(pages):
        page=writer.add_blank_page(width=612,height=792)
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica'),NameObject('/Encoding'):NameObject('/WinAnsiEncoding')})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
        stream=DecodedStreamObject()
        stream.set_data(f'BT /F1 12 Tf 50 700 Td ({text}) Tj ET'.encode('latin-1'))
        page[NameObject('/Contents')]=writer._add_object(stream)
    if encrypted: writer.encrypt('synthetic-password')
    output=BytesIO();writer.write(output);return output.getvalue()


def message():
    result=EmailMessage()
    result['From']='Qik <notificaciones@qik.do>'
    result['Authentication-Results']='mx.google.com; dkim=pass header.d=qik.do; dmarc=pass header.from=qik.do'
    result.set_content('Texto sintético de prueba.')
    return result


def candidate(**overrides):
    return Candidate(occurred_on='2026-10-28',description='Compra sintética',amount='10.10',currency='DOP',kind='expense',
                     source='pdf',source_key='documento-sintetico:1:1',institution='qik',**overrides)


def existing(**overrides):
    row=ExistingMovement('tx1','alice','account1',date(2026,10,28),'Compra sintética',Decimal('10.10'),'DOP','expense','manual','key1')
    return replace(row,**overrides)


def test_pdf_extracts_real_text_without_inventing_rows_or_balances():
    data=pdf()
    result=extract_pdf(data)
    assert 'Documento sintético' in result.pages[0]
    assert result.requires_ocr is False
    assert len(result.digest)==64
    assert extract_pdf(data).digest==result.digest


@pytest.mark.parametrize('data',[b'not a PDF',b'%PDF-1.7 broken',b''])
def test_invalid_pdf_is_rejected(data):
    with pytest.raises(UnsupportedFormat):extract_pdf(data)


def test_encrypted_pdf_and_excessive_pages_rejected():
    with pytest.raises(UnsupportedFormat,match='cifrados'):extract_pdf(pdf(encrypted=True))
    with pytest.raises(UnsupportedFormat,match='30 páginas'):extract_pdf(pdf(pages=31))


def test_scanned_pdf_requires_ocr_not_zero_balance():
    writer=PdfWriter();writer.add_blank_page(width=612,height=792);output=BytesIO();writer.write(output)
    result=extract_pdf(output.getvalue())
    assert result.requires_ocr is True


def test_active_pdf_and_oversized_pdf_rejected():
    writer=PdfWriter();writer.add_blank_page(width=612,height=792);writer.add_js("console.log('synthetic')")
    output=BytesIO();writer.write(output)
    with pytest.raises(UnsupportedFormat):extract_pdf(output.getvalue())
    with pytest.raises(UnsupportedFormat):extract_pdf(b'%PDF-'+b'0'*(8*1024*1024))


def test_mime_limits_reject_large_messages_without_processing():
    with pytest.raises(UnsupportedFormat):read_mime(b'0'*(2*1024*1024+1))


def test_plain_text_and_alternative_html_are_not_double_processed():
    mail=message();mail.add_alternative('<html><body><p>Versión duplicada</p></body></html>',subtype='html')
    result=read_mime(mail.as_bytes())
    assert result.text=='Texto sintético de prueba.'


def test_html_is_text_only_with_entities_and_without_scripts():
    mail=EmailMessage();mail.set_content('<html><head><style>hidden</style></head><body><script>secret()</script><p>Monto &amp; moneda</p><div>DOP 10.10</div></body></html>',subtype='html')
    text=read_mime(mail.as_bytes()).text
    assert 'Monto & moneda' in text and 'DOP 10.10' in text
    assert 'secret' not in text and 'hidden' not in text


def test_nested_rfc822_is_detected_and_attachments_are_ignored():
    inner=message();outer=EmailMessage();outer.set_content('Mensaje externo')
    outer.add_attachment(inner)
    outer.add_attachment(b'never extract this',maintype='application',subtype='pdf',filename='synthetic.pdf')
    result=read_mime(outer.as_bytes())
    assert result.contains_nested_message is True
    assert 'Texto sintético' in result.text
    assert 'never extract' not in result.text


def test_sender_visible_and_forged_uploaded_auth_headers_are_insufficient():
    mail=message()
    assert sender_evidence(mail,'qik') is False
    assert sender_evidence(mail,'qik',trusted_gmail_transport=True) is True
    mail.replace_header('Authentication-Results','mx.google.com; dkim=fail header.d=qik.do; dmarc=fail header.from=qik.do')
    assert sender_evidence(mail,'qik',trusted_gmail_transport=True) is False


def test_other_dkim_domain_or_unconfigured_popular_sender_is_rejected():
    mail=message()
    mail.replace_header('Authentication-Results','mx.google.com; dkim=pass header.d=attacker.example; dmarc=pass header.from=qik.do')
    assert sender_evidence(mail,'qik',trusted_gmail_transport=True) is False
    assert sender_evidence(message(),'popular',trusted_gmail_transport=True) is False


def test_ambiguous_multiple_auth_headers_require_review():
    mail=message();mail['Authentication-Results']='mx.google.com; dkim=pass header.d=qik.do; dmarc=pass header.from=qik.do'
    assert sender_evidence(mail,'qik',trusted_gmail_transport=True) is False


@pytest.mark.parametrize('institution',['qik','popular'])
def test_unverified_adapters_fail_closed(institution):
    adapter=ADAPTERS[institution]
    assert not adapter.verified_pdf and not adapter.verified_email
    with pytest.raises(UnsupportedFormat):adapter.parse_statement('No inventar movimientos.')
    with pytest.raises(UnsupportedFormat):adapter.parse_notification('No inventar movimientos.')


def test_same_source_key_is_idempotent_and_mutation_is_conflict():
    row=existing(source='pdf',source_key='documento-sintetico:1:1')
    assert reconcile(candidate(),[row],user_id='alice',account_id='account1').status=='duplicate'
    assert reconcile(candidate(),[replace(row,amount=Decimal('99'))],user_id='alice',account_id='account1').status=='source_conflict'


def test_same_amount_and_merchant_require_review_instead_of_silent_deletion():
    result=reconcile(candidate(),[existing()],user_id='alice',account_id='account1')
    assert result.status=='possible_duplicate'


def test_verified_bank_reference_deduplicates_across_sources():
    value=candidate(reference='synthetic-ref',reference_verified=True)
    row=existing(source='gmail',reference='synthetic-ref',reference_verified=True)
    assert reconcile(value,[row],user_id='alice',account_id='account1').status=='duplicate'


def test_other_user_or_currency_does_not_affect_reconciliation():
    rows=[existing(user_id='bob'),existing(currency='USD')]
    assert reconcile(candidate(),rows,user_id='alice',account_id='account1').matching_ids==()


def test_reversal_requires_one_verified_original_same_account_currency_and_amount():
    value=candidate(reference_verified=True).model_copy(update={'kind':'income'})
    row=existing(reference='original-synthetic',reference_verified=True)
    result=associate_reversal(value,[row],original_reference='original-synthetic',user_id='alice',account_id='account1')
    assert result.status=='reversal_link' and result.matching_ids==('tx1',)
    assert associate_reversal(value,[row,row],original_reference='original-synthetic',user_id='alice',account_id='account1').status=='needs_review'
    assert associate_reversal(value,[replace(row,user_id='bob')],original_reference='original-synthetic',user_id='alice',account_id='account1').status=='needs_review'
