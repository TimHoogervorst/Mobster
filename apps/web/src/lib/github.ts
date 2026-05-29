import { Octokit } from 'octokit'

// ─── Types ────────────────────────────────────────────

export interface GitHubRepo {
  id: number
  owner: string
  name: string
  fullName: string
  description: string | null
  language: string | null
  stars: number
  defaultBranch: string
  private: boolean
}

export interface GitHubIssue {
  githubId: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: string[]
  assignee: string | null
  milestone: string | null
  githubUrl: string
  githubCreatedAt: string
  githubUpdatedAt: string
}

export interface GitHubUser {
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
}

// ─── Client Factory ───────────────────────────────────

export function createGitHubClient(accessToken: string) {
  const octokit = new Octokit({ auth: accessToken })

  return {
    /**
     * Get the authenticated user's profile.
     */
    async getAuthenticatedUser(): Promise<GitHubUser> {
      const { data } = await octokit.rest.users.getAuthenticated()
      return {
        login: data.login,
        name: data.name ?? null,
        email: data.email ?? null,
        avatarUrl: data.avatar_url,
      }
    },

    /**
     * List all repositories the authenticated user has access to.
     * Sorted by most recently pushed.
     */
    async listRepos(): Promise<GitHubRepo[]> {
      const repos: GitHubRepo[] = []
      const iterator = octokit.paginate.iterator(octokit.rest.repos.listForAuthenticatedUser, {
        sort: 'pushed',
        per_page: 100,
        affiliation: 'owner,collaborator,organization_member',
      })

      for await (const { data } of iterator) {
        for (const repo of data) {
          repos.push({
            id: repo.id,
            owner: repo.owner.login,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description ?? null,
            language: repo.language ?? null,
            stars: repo.stargazers_count ?? 0,
            defaultBranch: repo.default_branch,
            private: repo.private,
          })
        }
      }

      return repos
    },

    /**
     * List issues for a repository.
     * If `since` is provided, only return issues updated after that date (incremental sync).
     */
    async listIssues(
      owner: string,
      repo: string,
      since?: Date,
    ): Promise<GitHubIssue[]> {
      const issues: GitHubIssue[] = []
      const iterator = octokit.paginate.iterator(octokit.rest.issues.listForRepo, {
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        since: since?.toISOString(),
      })

      for await (const { data } of iterator) {
        for (const issue of data) {
          // Skip pull requests (GitHub API returns PRs as issues)
          if (issue.pull_request) continue

          issues.push({
            githubId: issue.id,
            number: issue.number,
            title: issue.title,
            body: issue.body ?? null,
            state: issue.state as 'open' | 'closed',
            labels: issue.labels.map((l) =>
              typeof l === 'string' ? l : l.name ?? '',
            ).filter(Boolean),
            assignee: issue.assignee?.login ?? null,
            milestone: issue.milestone?.title ?? null,
            githubUrl: issue.html_url,
            githubCreatedAt: issue.created_at,
            githubUpdatedAt: issue.updated_at,
          })
        }
      }

      return issues
    },
  }
}
