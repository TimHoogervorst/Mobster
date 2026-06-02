import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve, normalize, dirname } from 'path'

/**
 * Tool definitions for Anthropic SDK tool-use.
 * These tools allow the agent to explore a git workspace during PRD generation.
 */

export const WORKSPACE_TOOLS = [
  {
    name: 'read_file',
    description: 'Read the contents of a file in the repository workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file, relative to the repository root.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List the contents of a directory in the repository workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory, relative to the repository root. Omit for root.',
        },
      },
    },
  },
  {
    name: 'search_code',
    description: 'Search for a text pattern in repository files using grep.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'The text or regex pattern to search for.',
        },
        path: {
          type: 'string',
          description: 'Directory path to search within, relative to repository root. Omit to search entire repo.',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the repository workspace. Creates parent directories if needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file, relative to the repository root.',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
]

export type WorkspaceToolName = 'read_file' | 'list_directory' | 'search_code' | 'write_file'

const MAX_FILE_SIZE = 100_000 // 100KB
const MAX_DIR_DEPTH = 5
const MAX_SEARCH_RESULTS = 50
const MAX_OUTPUT_LENGTH = 50_000 // Truncate tool outputs to 50KB

/**
 * Execute a workspace tool.
 * All paths are resolved relative to the workspace root.
 * Path traversal (../) is rejected for security.
 */
export function executeWorkspaceTool(
  toolName: WorkspaceToolName,
  input: Record<string, unknown>,
  workspaceRoot: string,
): string {
  try {
    switch (toolName) {
      case 'read_file':
        return readFile(input.path as string | undefined, workspaceRoot)
      case 'list_directory':
        return listDirectory(input.path as string | undefined, workspaceRoot)
      case 'search_code':
        return searchCode(input.pattern as string, input.path as string | undefined, workspaceRoot)
      case 'write_file':
        return writeFile(input.path as string, input.content as string, workspaceRoot)
      default:
        return `Unknown tool: ${toolName}`
    }
  } catch (error: any) {
    return `Error executing ${toolName}: ${error.message}`
  }
}

function safePath(relativePath: string | undefined, workspaceRoot: string): string {
  const input = relativePath || '.'
  // Resolve relative to workspace root
  const fullPath = resolve(workspaceRoot, input)
  // Security: ensure the resolved path is within the workspace
  const normalized = normalize(fullPath)
  if (!normalized.startsWith(resolve(workspaceRoot))) {
    throw new Error(`Path traversal not allowed: ${input}`)
  }
  return normalized
}

function readFile(relativePath: string | undefined, workspaceRoot: string): string {
  const fullPath = safePath(relativePath, workspaceRoot)
  const stat = statSync(fullPath)
  if (stat.isDirectory()) {
    return `'${relativePath || '.'}' is a directory. Use list_directory to see its contents.`
  }
  if (stat.size > MAX_FILE_SIZE) {
    return `File is too large (${stat.size} bytes). First ${MAX_FILE_SIZE} bytes:\n${readFileSync(fullPath, 'utf-8').slice(0, MAX_OUTPUT_LENGTH)}`
  }
  const content = readFileSync(fullPath, 'utf-8')
  if (content.length > MAX_OUTPUT_LENGTH) {
    return content.slice(0, MAX_OUTPUT_LENGTH) + `\n\n[... truncated at ${MAX_OUTPUT_LENGTH} chars, full size: ${content.length} chars]`
  }
  return content
}

function writeFile(relativePath: string | undefined, content: string, workspaceRoot: string): string {
  if (!relativePath) {
    return 'Error: path is required for write_file'
  }
  const fullPath = safePath(relativePath, workspaceRoot)
  // Create parent directories if they don't exist
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content, 'utf-8')
  const size = Buffer.byteLength(content, 'utf-8')
  const sizeStr = size > 1024 ? `${Math.round(size / 1024)}KB` : `${size}B`
  return `File written: ${relativePath} (${sizeStr})`
}

function listDirectory(relativePath: string | undefined, workspaceRoot: string): string {
  const fullPath = safePath(relativePath, workspaceRoot)
  const stat = statSync(fullPath)
  if (!stat.isDirectory()) {
    return `'${relativePath || '.'}' is not a directory. Use read_file to see its contents.`
  }
  return buildTree(fullPath, workspaceRoot, 0)
}

function buildTree(dirPath: string, root: string, depth: number): string {
  if (depth > MAX_DIR_DEPTH) return ''

  const entries = readdirSync(dirPath, { withFileTypes: true })
  // Skip hidden directories and common ignores
  const filtered = entries.filter((e) =>
    !e.name.startsWith('.') &&
    e.name !== 'node_modules' &&
    e.name !== 'dist' &&
    e.name !== '.next' &&
    e.name !== '__pycache__',
  )

  const lines: string[] = []
  const indent = '  '.repeat(depth)

  for (const entry of filtered.slice(0, 100)) { // Max 100 entries per directory
    const relativePath = dirPath.replace(root, '').replace(/\\/g, '/') || '/'
    if (entry.isDirectory()) {
      lines.push(`${indent}📁 ${entry.name}/`)
      const subTree = buildTree(join(dirPath, entry.name), root, depth + 1)
      if (subTree) lines.push(subTree)
    } else {
      const entryPath = join(dirPath, entry.name)
      try {
        const size = statSync(entryPath).size
        const sizeStr = size > 1024 ? `${Math.round(size / 1024)}KB` : `${size}B`
        lines.push(`${indent}📄 ${entry.name} (${sizeStr})`)
      } catch {
        lines.push(`${indent}📄 ${entry.name}`)
      }
    }
  }

  if (filtered.length > 100) {
    lines.push(`${indent}... and ${filtered.length - 100} more entries`)
  }

  return lines.join('\n')
}

function searchCode(pattern: string, relativePath: string | undefined, workspaceRoot: string): string {
  const searchDir = relativePath ? safePath(relativePath, workspaceRoot) : workspaceRoot

  // Skip grep on Windows — fall back directly to Node.js recursive search
  if (process.platform === 'win32') {
    return fallbackSearch(pattern, searchDir, workspaceRoot)
  }

  const { execSync } = require('child_process')
  try {
    const output = execSync(
      `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.md" --include="*.json" --include="*.py" --include="*.go" --include="*.rs" -e "${pattern.replace(/"/g, '\\"')}" "${searchDir}"`,
      {
        encoding: 'utf-8',
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      },
    )
    const lines = output.trim().split('\n')
    if (lines.length === 0 || (lines.length === 1 && !lines[0])) {
      return `No matches found for "${pattern}".`
    }
    if (lines.length > MAX_SEARCH_RESULTS) {
      return lines.slice(0, MAX_SEARCH_RESULTS).join('\n') +
        `\n\n[... ${lines.length - MAX_SEARCH_RESULTS} more results]`
    }
    return output.trim() || `No matches found for "${pattern}".`
  } catch (error: any) {
    // grep returns exit code 1 when no matches
    if (error.status === 1 && !error.stderr) {
      return `No matches found for "${pattern}".`
    }
    // Fall back to simple recursive search if grep is unavailable
    return fallbackSearch(pattern, searchDir, workspaceRoot)
  }
}

function fallbackSearch(pattern: string, searchDir: string, workspaceRoot: string): string {
  const results: string[] = []
  const lowerPattern = pattern.toLowerCase()

  function walk(dir: string, depth: number) {
    if (depth > MAX_DIR_DEPTH || results.length >= MAX_SEARCH_RESULTS) return
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full, depth + 1)
        } else if (/\.(ts|tsx|js|jsx|md|json|py|go|rs)$/.test(entry.name)) {
          try {
            const content = readFileSync(full, 'utf-8')
            const matchLines = content.split('\n').filter((l) => l.toLowerCase().includes(lowerPattern))
            for (const line of matchLines.slice(0, 3)) {
              results.push(`${full.replace(workspaceRoot, '')}: ${line.trim().slice(0, 200)}`)
            }
            if (matchLines.length > 3) {
              results.push(`  ... and ${matchLines.length - 3} more matches in this file`)
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walk(searchDir, 0)
  return results.length > 0
    ? results.join('\n')
    : `No matches found for "${pattern}".`
}
