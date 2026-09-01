function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderMarkdown(text: string): string {
  const escaped = escapeHtml(text)

  const codeBlocks: string[] = []
  let result = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const idx = codeBlocks.length
    codeBlocks.push(`<pre class="md-code-block"><code>${code.trim()}</code></pre>`)
    return `%%CODEBLOCK_${idx}%%`
  })

  const inlineCodes: string[] = []
  result = result.replace(/`([^`]+)`/g, (_match, code) => {
    const idx = inlineCodes.length
    inlineCodes.push(`<code class="md-inline-code">${code}</code>`)
    return `%%INLINECODE_${idx}%%`
  })

  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')

  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>',
  )

  const lines = result.split('\n')
  const output: string[] = []
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const listMatch = line.match(/^[\s]*[-*]\s+(.+)/)

    if (listMatch) {
      if (!inList) {
        output.push('<ul class="md-list">')
        inList = true
      }
      output.push(`<li>${listMatch[1]}</li>`)
    } else {
      if (inList) {
        output.push('</ul>')
        inList = false
      }

      const numberedMatch = line.match(/^[\s]*(\d+)\.\s+(.+)/)
      if (numberedMatch) {
        if (!inList) {
          output.push('<ol class="md-list">')
        }
        inList = false
        output.push(`<li>${numberedMatch[2]}</li>`)
      } else if (line.trim() === '') {
        output.push('<br/>')
      } else {
        output.push(`<p class="md-p">${line}</p>`)
      }
    }
  }

  if (inList) {
    output.push('</ul>')
  }

  result = output.join('\n')

  for (let i = 0; i < codeBlocks.length; i++) {
    result = result.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i])
  }
  for (let i = 0; i < inlineCodes.length; i++) {
    result = result.replace(`%%INLINECODE_${i}%%`, inlineCodes[i])
  }

  return result
}
