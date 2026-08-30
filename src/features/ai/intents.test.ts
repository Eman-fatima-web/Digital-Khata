import { describe, expect, it } from 'vitest'
import { detectIntent } from './intents'

describe('detectIntent — existing intents', () => {
  it('detects RECORD_PAYMENT', () => {
    // Test with simpler patterns that match the keyword lists
    expect(detectIntent('payment receive karo')).toBe('RECORD_PAYMENT')
    expect(detectIntent('jama karo')).toBe('RECORD_PAYMENT')
  })

  it('detects ADD_UDHAAR', () => {
    expect(detectIntent('udhaar de do')).toBe('ADD_UDHAAR')
    expect(detectIntent('udhaar likho')).toBe('ADD_UDHAAR')
  })

  it('detects DELETE_PAYMENT', () => {
    expect(detectIntent('Ahmed ki payment delete karo')).toBe('DELETE_PAYMENT')
    expect(detectIntent('remove payment for Ali')).toBe('DELETE_PAYMENT')
  })

  it('detects DELETE_UDHAAR', () => {
    expect(detectIntent('Ahmed ka udhaar delete karo')).toBe('DELETE_UDHAAR')
  })

  it('detects SEND_REMINDER', () => {
    expect(detectIntent('Ahmed ko reminder bhejo')).toBe('SEND_REMINDER')
    expect(detectIntent('whatsapp Ahmed')).toBe('SEND_REMINDER')
  })

  it('detects OVERDUE_CUSTOMERS', () => {
    expect(detectIntent('kis ka udhaar overdue hai')).toBe('OVERDUE_CUSTOMERS')
    expect(detectIntent('late payments list')).toBe('OVERDUE_CUSTOMERS')
  })

  it('detects TOP_DEBTORS', () => {
    expect(detectIntent('sabse zyada udhaar kis ka hai')).toBe('TOP_DEBTORS')
    expect(detectIntent('top debtors')).toBe('TOP_DEBTORS')
  })

  it('detects BUSINESS_INSIGHT', () => {
    expect(detectIntent('karobar kaisa chal raha hai')).toBe('BUSINESS_INSIGHT')
    expect(detectIntent('business overview')).toBe('BUSINESS_INSIGHT')
  })

  it('detects SALES_SUMMARY', () => {
    expect(detectIntent('aaj ki sale kitni hui')).toBe('SALES_SUMMARY')
    expect(detectIntent('show sales')).toBe('SALES_SUMMARY')
  })

  it('detects CUSTOMER_BALANCE', () => {
    expect(detectIntent('Ahmed ka balance batao')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('how much does Ahmed owe')).toBe('CUSTOMER_BALANCE')
  })

  it('detects CUSTOMER_HISTORY', () => {
    expect(detectIntent('Ahmed ka hisab dikhao')).toBe('CUSTOMER_HISTORY')
    expect(detectIntent('show Ahmed history')).toBe('CUSTOMER_HISTORY')
  })

  it('detects TOTALS', () => {
    expect(detectIntent('kul kitna hai')).toBe('TOTALS')
    expect(detectIntent('total summary')).toBe('TOTALS')
  })
})

describe('detectIntent — new intents', () => {
  it('detects GREETING', () => {
    expect(detectIntent('hello')).toBe('GREETING')
    expect(detectIntent('hi')).toBe('GREETING')
    expect(detectIntent('hey')).toBe('GREETING')
  })

  it('detects CREATE_CUSTOMER', () => {
    expect(detectIntent('naya customer add karo Ahmed')).toBe('CREATE_CUSTOMER')
    expect(detectIntent('add new customer Sara')).toBe('CREATE_CUSTOMER')
    expect(detectIntent('customer banao Ali')).toBe('CREATE_CUSTOMER')
  })

  it('detects RECORD_SALE', () => {
    expect(detectIntent('aaj ki sale likho 5000')).toBe('RECORD_SALE')
    expect(detectIntent('sale record karo 3000')).toBe('RECORD_SALE')
    expect(detectIntent('bikri likho')).toBe('RECORD_SALE')
  })

  it('detects HELP', () => {
    expect(detectIntent('help')).toBe('HELP')
    expect(detectIntent('madad karo')).toBe('HELP')
    expect(detectIntent('kya kar sakte ho')).toBe('HELP')
    expect(detectIntent('what can you do')).toBe('HELP')
  })
})

describe('detectIntent — mixed language', () => {
  it('handles English + Roman Urdu mix', () => {
    expect(detectIntent('Ahmed ka balance show karo')).toBe('CUSTOMER_BALANCE')
    expect(detectIntent('payment receive karo Ahmed ki')).toBe('RECORD_PAYMENT')
  })

  it('handles Urdu script + English mix', () => {
    expect(detectIntent('احمد کا balance')).toBe('CUSTOMER_BALANCE')
  })
})

describe('detectIntent — priority ordering', () => {
  it('GREETING takes priority over action intents', () => {
    expect(detectIntent('salam ahmed ka udhaar add karo')).toBe('GREETING')
  })

  it('CREATE_CUSTOMER takes priority over RECORD_PAYMENT when both could match', () => {
    expect(detectIntent('add customer Ahmed')).toBe('CREATE_CUSTOMER')
  })

  it('HELP is detected before UNKNOWN', () => {
    expect(detectIntent('help please')).toBe('HELP')
  })
})
