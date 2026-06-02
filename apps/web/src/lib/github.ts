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
     * Get a single repository by owner and name.
     * Works for any repo the token has access to (including public repos).
     */
    async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
      const { data } = await octokit.rest.repos.get({ owner, repo })
      return {
        id: data.id,
        owner: data.owner.login,
        name: data.name,
        fullName: data.full_name,
        description: data.description ?? null,
        language: data.language ?? null,
        stars: data.stargazers_count ?? 0,
        defaultBranch: data.default_branch,
        private: data.private,
      }
    },

    /**
     * Get the default branch ref (name + HEAD SHA) for a repository.
     */
    async getDefaultBranchRef(
      owner: string,
      repo: string,
    ): Promise<{ name: string; sha: string }> {
      const { data: repoData } = await octokit.rest.repos.get({ owner, repo })
      const branch = repoData.default_branch

      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      })

      return { name: branch, sha: refData.object.sha }
    },

    /**
     * Get a branch ref by name. Returns null if the branch doesn't exist.
     */
    async getBranch(
      owner: string,
      repo: string,
      branchName: string,
    ): Promise<{ name: string; sha: string } | null> {
      try {
        const { data } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
        })
        return { name: branchName, sha: data.object.sha }
      } catch (error: any) {
        if (error.status === 404) return null
        throw error
      }
    },

    /**
     * Create a pull request.
     * If a PR already exists between head and base, returns the existing PR info.
     */
    async createPullRequest(
      owner: string,
      repo: string,
      title: string,
      head: string,
      base: string,
      body?: string,
    ): Promise<{ url: string; number: number }> {
      try {
        const { data } = await octokit.rest.pulls.create({
          owner,
          repo,
          title,
          head,
          base,
          body,
        })
        return { url: data.html_url, number: data.number }
      } catch (error: any) {
        if (error.status === 422) {
          // PR may already exist — try to find it
          const { data: existing } = await octokit.rest.pulls.list({
            owner,
            repo,
            head: `${owner}:${head}`,
            base,
            state: 'open',
            per_page: 1,
          })
          if (existing.length > 0) {
            return { url: existing[0]!.html_url, number: existing[0]!.number }
          }
        }
        throw error
      }
    },

    /**
     * Fork a repository. If the user already has a fork, returns the existing one.
     */
    async forkRepo(
      owner: string,
      repo: string,
    ): Promise<{ owner: string; name: string; fullName: string }> {
      try {
        const { data } = await octokit.rest.repos.createFork({ owner, repo })
        return {
          owner: data.owner.login,
          name: data.name,
          fullName: data.full_name,
        }
      } catch (error: any) {
        if (error.status === 422 || error.status === 409) {
          // Fork already exists — look it up
          const user = await this.getAuthenticatedUser()
          try {
            const { data } = await octokit.rest.repos.get({
              owner: user.login,
              repo,
            })
            if (data.fork && data.parent?.full_name === `${owner}/${repo}`) {
              return {
                owner: data.owner.login,
                name: data.name,
                fullName: data.full_name,
              }
            }
          } catch {
            // Fall through to throw
          }
        }
        throw error
      }
    },

    /**
     * Check whether the authenticated user has push access to a repo.
     */
    async checkRepoPushAccess(
      owner: string,
      repo: string,
    ): Promise<{ hasPush: boolean; isOwner: boolean }> {
      const user = await this.getAuthenticatedUser()
      try {
        const { data } = await octokit.rest.repos.get({ owner, repo })
        return {
          hasPush: data.permissions?.push ?? false,
          isOwner: data.owner.login.toLowerCase() === user.login.toLowerCase(),
        }
      } catch (error: any) {
        if (error.status === 404) {
          return { hasPush: false, isOwner: false }
        }
        throw error
      }
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
