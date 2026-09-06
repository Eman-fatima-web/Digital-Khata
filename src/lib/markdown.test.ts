import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('renderMarkdown security', () => {
  it('allows safe http/https links with proper markup', () => {
    const html = renderMarkdown('[OpenAI](https://openai.com)')
    expect(html).toContain('<a href="https://openai.com" target="_blank" rel="noopener noreferrer" class="md-link">OpenAI</a>')
  })

  it('allows mailto and tel links', () => {
    expect(renderMarkdown('[Call](tel:+923001234567)')).toContain('href="tel:+923001234567"')
    expect(renderMarkdown('[Mail](mailto:test@example.com)')).toContain('href="mailto:test@example.com"')
  })

  it('strips javascript: URLs so they cannot be linked', () => {
    const html = renderMarkdown('[x](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<a href=')
  })

  it('strips data: text/html URLs', () => {
    const html = renderMarkdown('[x](data:text/html,<script>alert(1)</script>)')
    expect(html).not.toContain('data:')
    expect(html).not.toContain('<a href=')
  })

  it('strips vbscript: URLs', () => {
    const html = renderMarkdown('[x](vbscript:msgbox(1))')
    expect(html).not.toContain('vbscript:')
    expect(html).not.toContain('<a href=')
  })

  it('strips protocol-relative URLs', () => {
    const html = renderMarkdown('[x](//evil.example.com/path)')
    expect(html).not.toContain('//evil')
    expect(html).not.toContain('<a href=')
  })

  it('does not allow a bare anchor-like scheme in links', () => {
    const html = renderMarkdown('[x](ftp://example.com/file)')
    expect(html).not.toContain('<a href=')
  })

  it('removes event-handler attributes from rendered HTML', () => {
    const html = renderMarkdown('[x](https://ok.com) onmouseover="alert(1)"')
    expect(html).not.toContain('onmouseover')
  })

  it('renders plain text output when link is unsafe (only the label)', () => {
    const html = renderMarkdown('[Click me](javascript:evil())')
    expect(html).toContain('Click me')
    expect(html).not.toContain('javascript:')
  })
})