const DEFAULT_SYSTEM_PROMPT = `You are a senior software engineer implementing code changes from a Product Requirement Document (PRD).
You have access to a full git repository workspace and can write files to implement changes.

BEFORE implementing any changes, you MUST:
1. Read the CLAUDE.md file at the repository root to understand the project's conventions, architecture, and coding patterns
2. Explore the directory structure with list_directory to understand the codebase layout
3. Use search_code to find files related to the changes you're about to make
4. Read the relevant source files to understand the current implementation and patterns
5. Then implement the changes using write_file, matching the existing code style exactly

CRITICAL:
- Match the existing code style, naming conventions, import patterns, and formatting EXACTLY
- Do NOT rewrite or refactor unrelated code
- Only change files that are listed in the PRD's "Technical Changes" section
- Write proper error handling for all edge cases
- Use real file paths from the codebase — NEVER guess paths

After implementing all changes, run the project's test suite to verify your changes work.
Report the test results in a "## Test Results" section at the end of your response.`

/**
 * Builds the system and user prompts for PRD integration (code implementation).
 *
 * Unlike PRD generation, this prompt is NOT configurable via the agent's
 * systemPromptTemplate — it uses a hardcoded default. Custom integration
 * prompts will be tackled later as a separate agent setting.
 *
 * @param prdContent - The full PRD markdown content
 * @param repo - Repo context (fullName, language, description)
 * @param targetBranch - The branch being targeted
 * @param workspacePath - Optional workspace path for agent context
 */
export function buildIntegrationPrompt(
  prdContent: string,
  repo: {
    fullName: string
    language: string | null
    description: string | null
  },
  targetBranch: string,
  workspacePath?: string,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = DEFAULT_SYSTEM_PROMPT

  // Build workspace context section
  let workspaceSection = ''
  if (workspacePath) {
    workspaceSection = `
## WORKSPACE

The repository has been checked out to: \`${workspacePath}\`
You have full access to read, explore, and EDIT files in this directory.
**Start by reading the CLAUDE.md file** at \`${workspacePath}/CLAUDE.md\` to understand the project.

Use the tools available to you:
- \`read_file\` to inspect files
- \`list_directory\` to see the file structure
- \`search_code\` to find relevant code patterns
- \`write_file\` to create or modify files

Do NOT guess file paths or code patterns. Use the tools to find real ones from the codebase.
All file writes are relative to the workspace root.
`
  }

  const userPrompt = `Implement the code changes described in the following Product Requirement Document (PRD).

## REPOSITORY CONTEXT
- **Repository:** ${repo.fullName}
- **Language:** ${repo.language || 'Unknown'}
- **Description:** ${repo.description || 'No description'}
- **Target Branch:** ${targetBranch}
${workspaceSection}
## PRD TO IMPLEMENT

${prdContent}

## IMPLEMENTATION INSTRUCTIONS

1. Start by reading CLAUDE.md and exploring the codebase structure
2. Follow the "Technical Changes" section of the PRD exactly — it specifies which files to change and how
3. Use \`write_file\` to create new files or modify existing ones
4. Write tests as specified in the PRD's "Tests" section
5. After all code changes are complete, run the test suite (e.g. \`pnpm test\` or the project's test command from CLAUDE.md)
6. Report test results in a \`## Test Results\` section using EXACTLY that heading

## IMPORTANT

- Only modify files listed in the PRD's "Technical Changes" section
- Match the existing code style perfectly — look at imports, naming, formatting
- Handle edge cases and error states
- Do NOT change unrelated code
`.trim()

  return { systemPrompt, userPrompt }
}

/**
 * Default integration system prompt (hardcoded, not configurable yet).
 */
export { DEFAULT_SYSTEM_PROMPT as INTEGRATION_TEMPLATE }
