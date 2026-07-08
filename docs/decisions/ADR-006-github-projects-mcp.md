# ADR-006: GitHub Projects v2 via Local MCP Server (Replacing Multi-System Integration)

## Status

Accepted — 2026-07-07

## Context

Feature 003 (MCP Integration and Custom Skills — MVP2) planned support for three external backlog
systems: Jira Cloud, Linear, and GitHub Issues. This required three separate MCP adapter
implementations, three sets of credentials, three API schemas, and three publish hierarchies.

The user requirement was updated to: replace Jira/Linear/Azure DevOps integration with GitHub
Projects backlog integration via a local GitHub MCP server. The rationale was:

1. **Focus beats breadth at MVP**: Partial support for three systems is worse than complete
   support for one. GitHub Projects v2 covers the most common open-source and enterprise teams.
2. **Community GitHub MCP server**: `github-mcp-server` (npm v1.8.7) provides a stable, maintained
   tool surface for Projects v2, Issues, and PRs via stdio transport.
3. **No cloud relay**: The server runs locally via stdio transport — no additional SaaS dependency,
   no credential exposure to third parties.
4. **Single token**: One GitHub PAT with `project` + `repo` scopes replaces three separate API
   keys for Jira, Linear, and Azure DevOps.

## Decision

Use `github-mcp-server` (npm v1.8.7) run as a local stdio subprocess by the NestJS backend,
acting as an MCP client via `@modelcontextprotocol/sdk`'s `StdioClientTransport`.

**Scope**:
- GitHub Projects v2 only (not classic Projects v1)
- Classic GitHub PAT with `project` + `repo` scopes (fine-grained PATs deferred)
- Single target repository per session (multi-repo deferred)
- Jira Cloud, Linear, Azure DevOps: deferred to a future release

**Architecture**:
- `GithubMcpModule` (global NestJS singleton) spawns the `github-mcp-server` subprocess via
  `npx -y github-mcp-server stdio` on `OnModuleInit`; terminates it on `OnApplicationShutdown`.
- `GithubMcpClientService` wraps the MCP `Client` for tool calls.
- `GithubMcpCredentialsService` is the sole credential boundary — raw token never escapes.
- `.claude/mcp.json` separately configures the same npm package for Claude Code CLI skills.

**Supersedes**: Feature 003 task T001–T015 (MCP adapter infrastructure for Jira/Linear/GitHub)
and all Jira/Linear/GitHub Issues adapters. Feature 006 replaces those tasks with a single
GitHub-focused MCP client.

## Consequences

**Positive**:
- Simpler implementation: one adapter, one credential, one publish hierarchy.
- Official GitHub support: the MCP server is maintained by GitHub engineering.
- Cleaner Privacy boundary: one token source, one credential service.
- MVP2 ships faster with higher quality on a single integration.

**Negative**:
- Teams using Jira or Linear must wait for a future release.
- Azure DevOps teams have no MCP server available at all yet.
- GitHub PAT classic is required (fine-grained PATs cannot scope Projects v2 as of this writing).

**Implemented stories (Feature 006, branch `feat/github-backlog-mcp`)**:
- US1: MCP connection + `GithubMcpCredentialsService` / `GithubMcpClientService`
- US1b: GitHub Projects v2 board selector — `GET /api/github-projects/boards` lists boards via
  `list_projects`; `POST /api/github-projects/configure` stores owner + projectNumber + repoOwner/Name
- US2: Live backlog context injected into analysis stream when `backlogSourceType: 'live-github'`
- US3: `POST /api/github-projects/publish` (requires `confirmed: true`) creates issues + sub-issues
- US4 (analytics dashboard): deferred to P2

**Risk**:
- `github-mcp-server` tool names could change between releases; pinning to `^1.8.7` in
  `package.json` and `mcp.json` mitigates silent breakage.
- Sub-issues API is in public beta; the title-prefix fallback (FR-012) handles repos not enrolled.
