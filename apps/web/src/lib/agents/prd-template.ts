const DEFAULT_SYSTEM_PROMPT = `You are a senior product manager and technical architect.
Your task is to generate a detailed Product Requirement Document (PRD) from one or more GitHub issues.
You have access to a full git repository workspace.

BEFORE generating the PRD, you MUST:
1. Read the CLAUDE.md file at the repository root to understand the project's conventions, architecture, and coding patterns
2. Explore the directory structure with list_directory to understand the codebase layout
3. Use search_code to find files related to the issue you're addressing
4. Read the most relevant source files to understand the current implementation and patterns
5. Then generate the PRD with specific, real file paths, function names, and patterns from the actual codebase

Follow the exact section structure provided. Be specific, technical, and actionable.
Focus on concrete implementation details from the real codebase — not vague descriptions.
For each section, provide thorough, substantive content. Do NOT skip any section.`

/**
 * Builds the system and user prompts for PRD generation.
 *
 * @param issues - Array of issue data (title, body, labels)
 * @param repo - Repo context (fullName, language, description)
 * @param systemPromptTemplate - Optional custom system prompt from agent config
 * @param feedbackComments - Optional previous review comments for regeneration
 * @param workspacePath - Optional workspace path for agent context
 */
export function buildPrdPrompt(
  issues: Array<{
    number: number
    title: string
    body: string | null
    labels: string[]
  }>,
  repo: {
    fullName: string
    language: string | null
    description: string | null
  },
  systemPromptTemplate?: string | null,
  feedbackComments?: string[],
  workspacePath?: string,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = systemPromptTemplate || DEFAULT_SYSTEM_PROMPT

  // Build issue context
  const issueDescriptions = issues.map((issue) => {
    const labelStr = issue.labels.length > 0 ? issue.labels.join(', ') : 'none'
    return `
### Issue #${issue.number}: ${issue.title}
**Labels:** ${labelStr}
**Description:**
${issue.body || 'No description provided.'}
`.trim()
  }).join('\n\n')

  // Build feedback context if present
  let feedbackSection = ''
  if (feedbackComments && feedbackComments.length > 0) {
    feedbackSection = `
## PREVIOUS REVIEW FEEDBACK

The following feedback was provided on the previous version of this PRD. Please address ALL of these points in your revision:

${feedbackComments.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`
  }

  // Build workspace context
  let workspaceSection = ''
  if (workspacePath) {
    workspaceSection = `
## WORKSPACE

The repository has been checked out to: \`${workspacePath}\`
You have full access to read and explore this directory.
**Start by reading the CLAUDE.md file** at \`${workspacePath}/CLAUDE.md\` to understand the project.

Use the tools available to you:
- \`read_file\` to inspect files
- \`list_directory\` to see the file structure
- \`search_code\` to find relevant code patterns

Do NOT guess file paths or code patterns. Use the tools to find real ones from the codebase.
`
  }

  const userPrompt = `Generate a Product Requirement Document (PRD) for the following GitHub issue(s) in the repository **${repo.fullName}**.

## REPOSITORY CONTEXT
- **Repository:** ${repo.fullName}
- **Language:** ${repo.language || 'Unknown'}
- **Description:** ${repo.description || 'No description'}
${workspaceSection}
## ISSUES TO COVER
${issueDescriptions}
${feedbackSection}
## REQUIRED PRD STRUCTURE

Please output the PRD using EXACTLY the following section headers (use ## for each section title). Follow the instructions for each section carefully:

## Summary
A clear, concise description of the change being proposed. 2-4 sentences that capture what will be built and why.

## Problem
A clear description of what is currently happening, and what would change to resolve this. Describe the current behavior, the pain points, and the desired outcome. Be specific about who is affected and how.

## Changes
A list of files required to be changed, and what those changes will be. For each file, describe:
- The file path (use real paths from the codebase — search the workspace with list_directory and search_code)
- What it does currently (based on actual code — use read_file)
- What specific changes are needed
- Why this file needs to change

Also list any files that are **close to the change but should remain unchanged**, with the reason why they don't need modification.

## Technical Changes
A full, per-file breakdown of what will change. For each file from the Changes section:
- Provide the real file path as a subheading (### src/path/to/file.ts)
- Describe the technical approach in detail, referencing actual code patterns from the workspace
- Include possible code examples or pseudo-code showing the approach (based on existing code style)
- Mention any dependencies, imports, or types that need to be added
- Note any edge cases the implementation must handle

## Risks
A list of possible risks associated with this change:
- Which changes are large or complex?
- What are possible future bugs that could arise?
- What other parts of the system might be affected? (Use search_code to find coupling points)
- Are there any data migration or backwards compatibility concerns?
- How could the change fail in production?

## Tests
A list of tests that need to be created and should pass after this change is implemented. Reference the existing test patterns in the codebase:
- Unit tests (specific functions or components to test)
- Integration tests (interactions between components)
- Edge case tests (boundary conditions, error states)
- Manual verification steps (if applicable)
`.trim()

  return { systemPrompt, userPrompt }
}

/**
 * Default PRD generation system prompt if the agent has no custom template.
 */
export { DEFAULT_SYSTEM_PROMPT as PRD_TEMPLATE }
