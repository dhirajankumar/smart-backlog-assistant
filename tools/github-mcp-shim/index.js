#!/usr/bin/env node
'use strict';

/**
 * GitHub MCP Shim
 *
 * A self-contained MCP stdio server that exposes the GitHub API tools
 * expected by the Smart Backlog Assistant (list_projects, get_project,
 * list_project_items, create_issue, create_label, add_issue_to_project,
 * create_sub_issue). Uses GitHub REST + GraphQL APIs directly via
 * GITHUB_PERSONAL_ACCESS_TOKEN — no external npm dependencies.
 *
 * Protocol: JSON-RPC 2.0 over stdio, newline-delimited (NDJSON), matching
 * the framing used by @modelcontextprotocol/sdk StdioClientTransport.
 */

const https = require('https');
const readline = require('readline');

const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body != null ? JSON.stringify(body) : '';
    const req = https.request(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'smart-backlog-assistant-mcp-shim/1.0',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(bodyStr
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(bodyStr),
              }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function restGet(path) {
  return httpRequest('GET', path, null);
}

function restPost(path, body) {
  return httpRequest('POST', path, body);
}

async function graphql(query, variables) {
  const r = await restPost('/graphql', { query, variables: variables || {} });
  if (r.status === 401) {
    throw Object.assign(new Error('GitHub token missing or invalid (401 Unauthorized)'), { status: 401 });
  }
  if (r.status === 403) {
    throw Object.assign(new Error('GitHub token lacks required scopes (403 Forbidden)'), { status: 403 });
  }
  if (r.status !== 200) {
    throw new Error(`GitHub GraphQL returned ${r.status}: ${JSON.stringify(r.body)}`);
  }
  if (r.body?.errors?.length && !r.body.data) {
    throw new Error(`GraphQL errors: ${r.body.errors.map((e) => e.message).join('; ')}`);
  }
  if (r.body?.errors?.length) {
    process.stderr.write(`[github-mcp-shim] GraphQL partial errors: ${r.body.errors.map((e) => e.message).join('; ')}\n`);
  }
  return r.body.data;
}

// ---------------------------------------------------------------------------
// Tool: list_projects
// ---------------------------------------------------------------------------

async function toolListProjects({ owner, per_page }) {
  const first = Math.min(Number(per_page) || 20, 100);
  // Query user and org simultaneously; GitHub returns null (not an error) for
  // the one that doesn't match, so we use whichever has data.
  const query = `
    query($login: String!, $first: Int!) {
      asUser: user(login: $login) {
        projectsV2(first: $first) { nodes { number title } }
      }
      asOrg: organization(login: $login) {
        projectsV2(first: $first) { nodes { number title } }
      }
    }`;
  const data = await graphql(query, { login: owner, first });
  const userProjects = data?.asUser?.projectsV2?.nodes ?? [];
  const orgProjects = data?.asOrg?.projectsV2?.nodes ?? [];
  const projects = userProjects.length ? userProjects : orgProjects;
  return JSON.stringify({ projects });
}

// ---------------------------------------------------------------------------
// Tool: get_project
// ---------------------------------------------------------------------------

async function toolGetProject({ owner, project_number }) {
  const number = Number(project_number);
  const query = `
    query($login: String!, $number: Int!) {
      asUser: user(login: $login) { projectV2(number: $number) { id number title } }
      asOrg: organization(login: $login) { projectV2(number: $number) { id number title } }
    }`;
  const data = await graphql(query, { login: owner, number });
  const project = data?.asUser?.projectV2 ?? data?.asOrg?.projectV2;
  if (!project) throw new Error(`Project #${number} not found for owner '${owner}'`);
  return JSON.stringify(project);
}

// ---------------------------------------------------------------------------
// Tool: list_project_items
// ---------------------------------------------------------------------------

const ITEMS_FRAGMENT = `
  totalCount
  pageInfo { hasNextPage endCursor }
  nodes {
    content {
      ... on Issue {
        number title body state updatedAt
        labels(first: 20) { nodes { name } }
        repository { name }
      }
      ... on DraftIssue { title body updatedAt }
      ... on PullRequest {
        number title body state updatedAt
        repository { name }
      }
    }
    fieldValues(first: 8) {
      nodes {
        ... on ProjectV2ItemFieldSingleSelectValue {
          name
          field { ... on ProjectV2SingleSelectField { name } }
        }
      }
    }
  }`;

function mapItem(node) {
  const c = node.content;
  if (!c) return null;
  const priorityField = (node.fieldValues?.nodes ?? []).find(
    (f) => f.field?.name?.toLowerCase() === 'priority'
  );
  return {
    number: c.number ?? 0,
    title: c.title ?? '',
    body: c.body ?? null,
    state: c.state ?? 'OPEN',
    labels: (c.labels?.nodes ?? []).map((l) => l.name),
    priority: priorityField?.name ?? null,
    updatedAt: c.updatedAt ?? new Date().toISOString(),
    repository: c.repository ? { name: c.repository.name } : null,
  };
}

async function toolListProjectItems({ owner, project_number, per_page, after }) {
  const number = Number(project_number);
  const first = Math.min(Number(per_page) || 100, 100);
  const afterVar = after || null;

  const query = `
    query($login: String!, $number: Int!, $first: Int!, $after: String) {
      asUser: user(login: $login) {
        projectV2(number: $number) {
          items(first: $first, after: $after) { ${ITEMS_FRAGMENT} }
        }
      }
      asOrg: organization(login: $login) {
        projectV2(number: $number) {
          items(first: $first, after: $after) { ${ITEMS_FRAGMENT} }
        }
      }
    }`;

  const data = await graphql(query, { login: owner, number, first, after: afterVar });
  const proj = data?.asUser?.projectV2 ?? data?.asOrg?.projectV2;
  if (!proj) throw new Error(`Project #${number} not found for owner '${owner}'`);

  const itemsPage = proj.items ?? {};
  const items = (itemsPage.nodes ?? []).map(mapItem).filter(Boolean);
  const totalCount = itemsPage.totalCount ?? 0;
  const nextCursor = itemsPage.pageInfo?.hasNextPage ? itemsPage.pageInfo.endCursor : null;

  return JSON.stringify({ items, totalCount, nextCursor });
}

// ---------------------------------------------------------------------------
// Tool: create_issue
// ---------------------------------------------------------------------------

async function toolCreateIssue({ owner, repo, title, body, labels }) {
  const r = await restPost(`/repos/${owner}/${repo}/issues`, {
    title: title || '',
    body: body || '',
    labels: Array.isArray(labels) ? labels : [],
  });
  if (r.status !== 201) {
    throw Object.assign(
      new Error(`Failed to create issue (${r.status}): ${r.body?.message ?? JSON.stringify(r.body)}`),
      { status: r.status }
    );
  }
  return JSON.stringify(r.body);
}

// ---------------------------------------------------------------------------
// Tool: create_label
// ---------------------------------------------------------------------------

async function toolCreateLabel({ owner, repo, name, color, description }) {
  const r = await restPost(`/repos/${owner}/${repo}/labels`, {
    name,
    color: (color || 'ededed').replace(/^#/, ''),
    description: description || '',
  });
  // 422 = label already exists — treat as success
  if (r.status !== 201 && r.status !== 422) {
    throw Object.assign(
      new Error(`Failed to create label (${r.status}): ${r.body?.message ?? JSON.stringify(r.body)}`),
      { status: r.status }
    );
  }
  return JSON.stringify(r.body || { name, color: color || 'ededed' });
}

// ---------------------------------------------------------------------------
// Tool: add_issue_to_project
// ---------------------------------------------------------------------------

async function toolAddIssueToProject({ owner, project_number, issue_number, repo_owner, repo_name }) {
  const projNum = Number(project_number);
  const issNum = Number(issue_number);
  const repoOwner = repo_owner || owner;

  // Resolve issue node_id
  const issueRes = await restGet(`/repos/${repoOwner}/${repo_name}/issues/${issNum}`);
  if (issueRes.status !== 200) {
    throw Object.assign(
      new Error(`Issue #${issNum} not found in ${repoOwner}/${repo_name} (${issueRes.status})`),
      { status: issueRes.status }
    );
  }
  const issueNodeId = issueRes.body.node_id;

  // Resolve project node_id
  const projQuery = `
    query($login: String!, $number: Int!) {
      asUser: user(login: $login) { projectV2(number: $number) { id } }
      asOrg: organization(login: $login) { projectV2(number: $number) { id } }
    }`;
  const projData = await graphql(projQuery, { login: owner, number: projNum });
  const projectId = projData?.asUser?.projectV2?.id ?? projData?.asOrg?.projectV2?.id;
  if (!projectId) throw new Error(`Project #${projNum} not found for owner '${owner}'`);

  // Add to project
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }`;
  const mutData = await graphql(mutation, { projectId, contentId: issueNodeId });
  return JSON.stringify({ added: true, itemId: mutData?.addProjectV2ItemById?.item?.id ?? null });
}

// ---------------------------------------------------------------------------
// Tool: create_sub_issue
// ---------------------------------------------------------------------------

async function toolCreateSubIssue({ owner, repo, issue_number, title, body, labels }) {
  // GitHub nested issues (beta) — the app gracefully falls back when this
  // returns 404 (feature not enabled for repo) or 422 (validation error).
  const r = await restPost(`/repos/${owner}/${repo}/issues/${issue_number}/sub_issues`, {
    title: title || '',
    body: body || '',
    labels: Array.isArray(labels) ? labels : [],
  });
  if (r.status >= 400) {
    throw Object.assign(
      new Error(`Sub-issue creation failed (${r.status}): ${r.body?.message ?? JSON.stringify(r.body)}`),
      { status: r.status }
    );
  }
  return JSON.stringify(r.body);
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

const TOOL_DEFS = [
  {
    name: 'list_projects',
    description: 'List GitHub Projects v2 for an owner (user or organisation)',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'GitHub user or org login' },
        per_page: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
      required: ['owner'],
    },
  },
  {
    name: 'get_project',
    description: 'Get GitHub Project v2 metadata by project number',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        project_number: { type: 'number' },
      },
      required: ['owner', 'project_number'],
    },
  },
  {
    name: 'list_project_items',
    description: 'List items (issues, drafts, PRs) in a GitHub Project v2 with pagination',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        project_number: { type: 'number' },
        per_page: { type: 'number', description: 'Items per page (max 100)' },
        after: { type: 'string', description: 'Pagination cursor (endCursor from previous page)' },
      },
      required: ['owner', 'project_number'],
    },
  },
  {
    name: 'create_issue',
    description: 'Create a GitHub issue in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'create_label',
    description: 'Create or ensure a label exists in a GitHub repository (422 = already exists, treated as success)',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        name: { type: 'string' },
        color: { type: 'string', description: 'Hex colour without # (e.g. "0075ca")' },
        description: { type: 'string' },
      },
      required: ['owner', 'repo', 'name'],
    },
  },
  {
    name: 'add_issue_to_project',
    description: 'Add an existing issue to a GitHub Projects v2 board',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Project owner login' },
        project_number: { type: 'number' },
        issue_number: { type: 'number' },
        repo_owner: { type: 'string', description: 'Repo owner (defaults to project owner)' },
        repo_name: { type: 'string', description: 'Repo name containing the issue' },
      },
      required: ['owner', 'project_number', 'issue_number', 'repo_owner', 'repo_name'],
    },
  },
  {
    name: 'create_sub_issue',
    description: 'Create a sub-issue linked to a parent issue (GitHub nested issues beta; falls back on 404/422)',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        issue_number: { type: 'number', description: 'Parent issue number' },
        title: { type: 'string' },
        body: { type: 'string' },
        labels: { type: 'array', items: { type: 'string' } },
      },
      required: ['owner', 'repo', 'issue_number', 'title'],
    },
  },
];

const HANDLERS = {
  list_projects: toolListProjects,
  get_project: toolGetProject,
  list_project_items: toolListProjectItems,
  create_issue: toolCreateIssue,
  create_label: toolCreateLabel,
  add_issue_to_project: toolAddIssueToProject,
  create_sub_issue: toolCreateSubIssue,
};

// ---------------------------------------------------------------------------
// MCP stdio protocol — JSON-RPC 2.0, NDJSON framing
// ---------------------------------------------------------------------------

function sendMsg(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function sendErr(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  // Notifications have no id and must not receive a response
  if (msg.id === undefined || msg.id === null) return;

  const { id, method, params } = msg;

  try {
    if (method === 'initialize') {
      sendMsg(id, {
        protocolVersion: params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'github-mcp-shim', version: '1.0.0' },
      });
    } else if (method === 'tools/list') {
      sendMsg(id, { tools: TOOL_DEFS });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params ?? {};
      const handler = HANDLERS[name];
      if (!handler) {
        sendMsg(id, {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        });
        return;
      }
      try {
        const text = await handler(args || {});
        sendMsg(id, { content: [{ type: 'text', text }], isError: false });
      } catch (err) {
        sendMsg(id, {
          content: [{ type: 'text', text: err.message }],
          isError: true,
        });
      }
    } else if (method === 'ping') {
      sendMsg(id, {});
    } else {
      sendErr(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    sendErr(id, -32603, `Internal error: ${err.message}`);
  }
});

process.stdin.resume();
