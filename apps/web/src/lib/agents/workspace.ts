import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const execFileAsync = promisify(execFile)

const WORKSPACE_ROOT = process.env.WORKSPACE_PATH ?? join(process.cwd(), 'workspaces')
const CACHE_DIR = join(WORKSPACE_ROOT, '.cache')

/**
 * Prepare a workspace for PRD generation:
 * 1. Creates a bare mirror cache for the repo (if not already cached)
 * 2. Updates the cache (git fetch)
 * 3. Clones from the local cache into a per-PRD workspace
 *
 * Returns the absolute path to the workspace directory.
 */
export async function prepareWorkspace(
  repo: { owner: string; name: string; fullName: string },
  accessToken: string,
  prdId: string,
): Promise<string> {
  // Ensure directories exist
  mkdirSync(WORKSPACE_ROOT, { recursive: true })
  mkdirSync(CACHE_DIR, { recursive: true })

  const cacheName = `${repo.owner}-${repo.name}.git`
  const cachePath = join(CACHE_DIR, cacheName)
  const workspacePath = join(WORKSPACE_ROOT, `prd-${prdId}`)

  // Step 1: Create or update the bare mirror cache
  if (!existsSync(cachePath)) {
    console.log(`[workspace] Creating bare mirror cache for ${repo.fullName}...`)
    await execFileAsync('git', [
      'clone',
      '--mirror',
      `https://x-access-token:${accessToken}@github.com/${repo.fullName}.git`,
      cachePath,
    ], {
      timeout: 120_000, // 2 min timeout for clone
    })
    console.log(`[workspace] Bare mirror created at ${cachePath}`)
  } else {
    // Update the cache
    try {
      console.log(`[workspace] Updating bare mirror cache for ${repo.fullName}...`)
      await execFileAsync('git', ['fetch', 'origin'], {
        cwd: cachePath,
        timeout: 30_000,
      })
      console.log(`[workspace] Bare mirror cache updated`)
    } catch (error: any) {
      // Non-fatal: proceed with possibly stale cache
      console.warn(`[workspace] Cache update failed (continuing with existing cache):`, error.message)
    }
  }

  // Step 2: Clone from local cache into per-PRD workspace
  console.log(`[workspace] Cloning workspace from cache to ${workspacePath}...`)
  await execFileAsync('git', [
    'clone',
    cachePath,
    workspacePath,
  ], {
    timeout: 60_000,
  })

  // Check out default branch (bare mirror clones may leave detached HEAD)
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: workspacePath,
      timeout: 5_000,
    })
    if (stdout.trim() === 'HEAD') {
      // Detached HEAD — check out main or master
      for (const branch of ['main', 'master']) {
        try {
          await execFileAsync('git', ['checkout', branch], { cwd: workspacePath, timeout: 5_000 })
          break
        } catch {
          // Try next
        }
      }
    }
  } catch {
    // Non-fatal
  }

  console.log(`[workspace] Workspace ready at ${workspacePath}`)
  return workspacePath
}

/**
 * Get the workspace root directory (for listing workspaces in settings).
 */
export function getWorkspaceRoot(): string {
  return WORKSPACE_ROOT
}
