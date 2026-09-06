import { describe, expect, it } from 'vitest'
import { detectIntent } from './intents'

describe('detectIntent — existing intents', () => {
  it('detects RECORD_PAYMENT', () => {
    expect(detectIntent('record payment')).toBe('RECORD_PAYMENT')
    expect(detectIntent('payment received')).toBe('RECORD_PAYMENT')
    expect(detectIntent('collect payment')).toBe('RECORD_PAYMENT')
    expect(detectIntent('ادائیگی وصول کرو')).toBe('RECORD_PAYMENT')
  })

  it('detects ADD_UDHAAR', () => {
    expect(detectIntent('add credit')).toBe('ADD_UDHAAR')
    expect(detectIntent('ادھار لکھو')).toBe('ADD_UDHAAR')
    expect(detectIntent('record credit')).toBe('ADD_UDHAAR')
  })

  it('detects DELETE_PAYMENT', () => {
    expect(detectIntent('delete payment Ahmed')).toBe('DELETE_PAYMENT')
    expect(detectIntent('remove payment for Ali')).toBe('DELETE_PAYMENT')
  })

  it('detects DELETE_UDHAAR', () => {
    expect(detectIntent('delete credit Ahmed')).toBe('DELETE_UDHAAR')
    expect(detectIntent('remove credit')).toBe('DELETE_UDHAAR')
  })

  it('detects SEND_REMINDER', () => {
    expect(detectIntent('remind Ahmed')).toBe('SEND_REMINDER')
    expect(detectIntent('whatsapp Ahmed')).toBe('SEND_REMINDER')
    expect(detectIntent('reminder for Ahmed')).toBe('SEND_REMINDER')
  })

  it('detects OVERDUE_CUSTOMERS', () => {
    expect(detectIntent('overdue credit list')).toBe('OVERDUE_CUSTOMERS')
    expect(detectIntent('late payments list')).toBe('OVERDUE_CUSTOMERS')
  })

  it('detects TOP_DEBTORS', () => {
    expect(detectIntent('top debtors')).toBe('TOP_DEBTORS')
    expect(detectIntent('top balance')).toBe('TOP_DEBTORS')
  })

  it('detects BUSINESS_INSIGHT', () => {
    expect(detectIntent('business overview')).toBe('BUSINESS_INSIGHT')
    expect(detectIntent('business insight')).toBe('BUSINESS_INSIGHT')
    expect(detectIntent('shop overview')).toBe('BUSINESS_INSIGHT')
  })

  it('detects SALES_SUMMARY', () => {
    expect(detectIntent('show sales')).toBe('SALES_SUMMARY')
    expect(detectIntent('sales summary')).toBe('SALES_SUMMARY')
    expect(detectIntent('فروخت دکھاؤ')).toBe('SALES_SUMMARY')
  })

  it('detects CUSTOMER_BALANCE', () => {
    expect(detectIntent('Ahmed balance')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('how much does Ahmed owe')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('احمد کا balance')).toBe('CUSTOMER_BALANCE')
  })

  it('detects CUSTOMER_HISTORY', () => {
    expect(detectIntent('Ahmed history')).toBe('CUSTOMER_HISTORY')
    expect(detectIntent('show Ahmed records')).toBe('CUSTOMER_HISTORY')
    expect(detectIntent('احمد کا حساب')).toBe('CUSTOMER_HISTORY')
  })

  it('detects TOTALS', () => {
    expect(detectIntent('total summary')).toBe('TOTALS')
    expect(detectIntent('کل کتنا ہے')).toBe('TOTALS')
  })
})

describe('detectIntent — new intents', () => {
  it('detects GREETING', () => {
    expect(detectIntent('hello')).toBe('GREETING')
    expect(detectIntent('hi')).toBe('GREETING')
    expect(detectIntent('hey')).toBe('GREETING')
    expect(detectIntent('سلام')).toBe('GREETING')
    expect(detectIntent('kia hal he')).toBe('GREETING')
    expect(detectIntent('kya haal hai')).toBe('GREETING')
    expect(detectIntent('salam')).toBe('GREETING')
    expect(detectIntent('assalam o alaikum')).toBe('GREETING')
    expect(detectIntent('kaise ho')).toBe('GREETING')
  })

  it('detects CREATE_CUSTOMER', () => {
    expect(detectIntent('add new customer Sara')).toBe('CREATE_CUSTOMER')
    expect(detectIntent('create customer Ali')).toBe('CREATE_CUSTOMER')
    expect(detectIntent('نیا گاہک احمد')).toBe('CREATE_CUSTOMER')
  })

  it('detects RECORD_SALE', () => {
    expect(detectIntent('sale record 5000')).toBe('RECORD_SALE')
    expect(detectIntent('sale entry 3000')).toBe('RECORD_SALE')
    expect(detectIntent('فروخت لکھو')).toBe('RECORD_SALE')
  })

  it('detects HELP', () => {
    expect(detectIntent('help')).toBe('HELP')
    expect(detectIntent('مدد')).toBe('HELP')
    expect(detectIntent('what can you do')).toBe('HELP')
    expect(detectIntent('guide')).toBe('HELP')
    expect(detectIntent('kia ap help kr skte he meri')).toBe('HELP')
    expect(detectIntent('madad karo')).toBe('HELP')
    expect(detectIntent('kia kar sakte ho')).toBe('HELP')
  })

  it('detects RECEIVED_REPORT', () => {
    expect(detectIntent('received report')).toBe('RECEIVED_REPORT')
    expect(detectIntent('received payments report')).toBe('RECEIVED_REPORT')
    expect(detectIntent('payment received report')).toBe('RECEIVED_REPORT')
    expect(detectIntent('وصولی رپورٹ')).toBe('RECEIVED_REPORT')
  })

  it('detects SEND_OVERDUE_REMINDERS', () => {
    expect(detectIntent('send overdue reminders')).toBe('SEND_OVERDUE_REMINDERS')
    expect(detectIntent('remind all customers')).toBe('SEND_OVERDUE_REMINDERS')
    expect(detectIntent('send reminders')).toBe('SEND_OVERDUE_REMINDERS')
    expect(detectIntent('send overdue')).toBe('SEND_OVERDUE_REMINDERS')
  })

  it('distinguishes SEND_REMINDER (single) from SEND_OVERDUE_REMINDERS (batch)', () => {
    expect(detectIntent('remind Ahmed')).toBe('SEND_REMINDER')
    expect(detectIntent('remind all customers')).toBe('SEND_OVERDUE_REMINDERS')
  })
})

describe('detectIntent — mixed language', () => {
  it('handles Urdu script + English mix', () => {
    expect(detectIntent('balance احمد')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('delete ادھار')).toBe('DELETE_UDHAAR')
  })
})

describe('detectIntent — priority ordering', () => {
  it('a greeting hiding a real command falls through to the command', () => {
    expect(detectIntent('salam, Ahmed ka balance batao')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('assalam o alaikum, Ahmed ko 5000 credit add karo')).toBe('ADD_UDHAAR')
    expect(detectIntent('hello ahmed credit add')).toBe('ADD_UDHAAR')
    expect(detectIntent('salam bhai, help chahiye')).toBe('HELP')
    expect(detectIntent('hi, is month meri sales kitni hain?')).toBe('MONTHLY_SALES')
  })

  it('keeps pure greetings as GREETING', () => {
    expect(detectIntent('hello ahmed')).toBe('GREETING')
    expect(detectIntent('assalam o alaikum')).toBe('GREETING')
    expect(detectIntent('salam kya haal hai bhai')).toBe('GREETING')
  })

  it('CREATE_CUSTOMER takes priority over RECORD_PAYMENT when both could match', () => {
    expect(detectIntent('add customer Ahmed')).toBe('CREATE_CUSTOMER')
  })

  it('HELP is detected before UNKNOWN', () => {
    expect(detectIntent('help please')).toBe('HELP')
  })

  it('detects Roman Urdu khata-opening as APP_INFO', () => {
    expect(detectIntent('yr mujhe khata khulwana he apna')).toBe('APP_INFO')
    expect(detectIntent('mujhe apna khata kholo')).toBe('APP_INFO')
    expect(detectIntent('khata shuru karna hai')).toBe('APP_INFO')
    expect(detectIntent('naya khata banao')).toBe('APP_INFO')
    expect(detectIntent('khata create karna he')).toBe('APP_INFO')
  })

  it('detects form-guide questions as APP_INFO (fields what to write)', () => {
    expect(detectIntent('customer me kya likhna he')).toBe('APP_INFO')
    expect(detectIntent('udhaar form me kya dalna he')).toBe('APP_INFO')
    expect(detectIntent('payment fields batao')).toBe('APP_INFO')
    expect(detectIntent('sale form kaise bharein')).toBe('APP_INFO')
    expect(detectIntent('مصنوعات کے فارم میں کیا لکھیں؟')).toBe('APP_INFO')
    expect(detectIntent('saare fields batao')).toBe('APP_INFO')
  })

  it('does not hijack financial queries with field-guide signals', () => {
    expect(detectIntent('Ahmed ka balance btao')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('add credit Ahmed ko')).toBe('ADD_UDHAAR')
    expect(detectIntent('record payment from Ahmed')).toBe('RECORD_PAYMENT')
  })
})

describe('detectIntent — negation blocking', () => {
  it('blocks DELETE when negated in English', () => {
    expect(detectIntent("don't delete Ahmed's payment")).toBe('UNKNOWN')
  })

  it('blocks DELETE when negated in Urdu script', () => {
    expect(detectIntent('مت حذف کرو احمد کا ادھار')).toBe('UNKNOWN')
  })

  it('blocks ADD_UDHAAR when negated', () => {
    expect(detectIntent("don't add credit for Ahmed")).toBe('UNKNOWN')
  })

  it('blocks RECORD_PAYMENT when negated', () => {
    expect(detectIntent('do not receive payment from Ahmed')).toBe('UNKNOWN')
  })

  it('does not block query intents when negated', () => {
    expect(detectIntent("don't show me Ahmed's balance")).toBe('CUSTOMER_BALANCE')
  })
})

describe('detectIntent — Roman Urdu support', () => {
  it('detects CUSTOMER_BALANCE for Roman Urdu udhaar questions', () => {
    expect(detectIntent('Ahmed ka kitna udhaar hai?')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('Ahmed kitna udhaar deta hai?')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('Ahmed ka balance kitna hai?')).toBe('CUSTOMER_BALANCE')
  })

  it('detects TOP_DEBTORS for Roman Urdu sabse zyada udhaar', () => {
    expect(detectIntent('Sabse zyada udhaar kis ka hai?')).toBe('TOP_DEBTORS')
    expect(detectIntent('kis ka udhaar sabse zyada hai?')).toBe('TOP_DEBTORS')
  })

  it('detects TOTALS for Roman Urdu kitna/kitne questions', () => {
    expect(detectIntent('meri total udhaar kitni hai?')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('kitne customers hain?')).toBe('TOTALS')
  })

  it('detects MONTHLY_SALES for Roman Urdu is month sales', () => {
    expect(detectIntent('Is month meri sales kitni hain?')).toBe('MONTHLY_SALES')
  })
})
