'use client'

interface PrdViewerProps {
  content: string
}

const SECTIONS = [
  { key: 'Summary', title: 'Summary' },
  { key: 'Problem', title: 'Problem' },
  { key: 'Changes', title: 'Changes' },
  { key: 'Technical Changes', title: 'Technical Changes' },
  { key: 'Risks', title: 'Risks' },
  { key: 'Tests', title: 'Tests' },
]

/**
 * Read-only PRD content display.
 * Parses the 6-section markdown and renders each section.
 */
export function PrdViewer({ content }: PrdViewerProps) {
  if (!content) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">PRD content is being generated...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map((section) => {
        const sectionContent = extractSection(content, section.key)
        return (
          <details key={section.key} className="rounded-lg border" open>
            <summary className="cursor-pointer px-4 py-3 font-medium text-sm hover:bg-accent/50 rounded-t-lg">
              {section.title}
              {!sectionContent && (
                <span className="ml-2 text-xs text-muted-foreground">(empty)</span>
              )}
            </summary>
            {sectionContent && (
              <div className="px-4 py-3 border-t prose prose-sm dark:prose-invert max-w-none">
                {renderMarkdown(sectionContent)}
              </div>
            )}
          </details>
        )
      })}
    </div>
  )
}

/**
 * Extract a section from the PRD content.
 * Sections are delimited by ## SectionName headers.
 */
function extractSection(content: string, sectionName: string): string | null {
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(
    `##\\s+${escapedName}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    'i',
  )
  const match = content.match(regex)
  if (!match) return null
  return match[1]!.trim()
}

/**
 * Simple markdown renderer — converts basic markdown to JSX.
 * For a production app, use react-markdown or similar.
 */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]!

    // Code blocks (```)
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // Skip closing ```
      elements.push(
        <pre key={i} className="bg-muted rounded-md p-3 my-2 overflow-x-auto text-xs">
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // Subheading (###)
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold mt-4 mb-1">
          {line.slice(4)}
        </h4>,
      )
      i++
      continue
    }

    // Inline code (`code`)
    // List items
    if (line.match(/^[\s]*[-*]\s/)) {
      elements.push(
        <li key={i} className="text-sm ml-4">
          {formatInline(line.replace(/^[\s]*[-*]\s/, ''))}
        </li>,
      )
      i++
      continue
    }

    // Numbered list
    if (line.match(/^[\s]*\d+\.\s/)) {
      elements.push(
        <li key={i} className="text-sm ml-4">
          {formatInline(line.replace(/^[\s]*\d+\.\s/, ''))}
        </li>,
      )
      i++
      continue
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />)
      i++
      continue
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm my-1">
        {formatInline(line)}
      </p>,
    )
    i++
  }

  return elements
}

function formatInline(text: string): React.ReactNode {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    // Inline code
    const codeParts = part.split(/(`[^`]+`)/g)
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return (
          <code key={`${i}-${j}`} className="bg-muted px-1 rounded text-xs">
            {cp.slice(1, -1)}
          </code>
        )
      }
      return cp
    })
  })
}
