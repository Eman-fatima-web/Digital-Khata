import { describe, expect, it } from 'vitest'
import { toCsv } from './export'

describe('toCsv security', () => {
  it('prefixes cells starting with = to block spreadsheet formulas', () => {
    expect(toCsv([{ Name: '=1+1', Age: 30 }])).toContain(`'=1+1`)
    expect(toCsv([{ Name: '=HYPERLINK("x")', Age: 30 }])).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('prefixes cells starting with + - @ to block formulas', () => {
    expect(toCsv([{ a: '+cmd', b: '-2+3', c: '@SUM(1)' }])).toContain(`'+cmd`)
    expect(toCsv([{ a: '+cmd', b: '-2+3', c: '@SUM(1)' }])).toContain(`'-2+3`)
    expect(toCsv([{ a: '+cmd', b: '-2+3', c: '@SUM(1)' }])).toContain(`'@SUM(1)`)
  })

  it('does not prefix ordinary text or numbers', () => {
    const csv = toCsv([{ a: 'hello', b: '123', c: '' }])
    expect(csv).toContain('hello')
    expect(csv).toContain('123')
    expect(csv).not.toContain("'hello")
    expect(csv).not.toContain("'123")
  })

  it('keeps existing quoting behavior intact', () => {
    const csv = toCsv([{ a: 'say "hi"', b: 5 }])
    expect(csv).toContain(`"say ""hi"""`)
  })
})