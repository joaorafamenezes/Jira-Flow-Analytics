import type { Version3Client } from 'jira.js';
import { env } from '../../config/env';

export type JiraRuntimeConfig = {
  host?: string;
  email?: string;
  apiToken?: string;
  projectKey?: string;
  defaultJql?: string;
};

export type ResolvedJiraConfig = {
  host: string;
  email: string;
  apiToken: string;
  projectKey: string;
  defaultJql: string;
};

export type JiraIssueSummary = {
  id: string;
  key: string;
  summary: string;
  status: string;
  issueType: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  customFields?: Record<string, string | null>;
};

export type JiraChangelogEntry = {
  created?: string;
  items?: Array<{
    field?: string;
    from?: string | null;
    fromString?: string | null;
    to?: string | null;
    toString?: string | null;
  }>;
};

type JiraSearchResponse = {
  issues?: Array<{
    id?: string;
    key?: string;
    fields?: {
      [key: string]: unknown;
      summary?: string;
      status?: { name?: string };
      issuetype?: { name?: string };
      created?: string;
      updated?: string;
      resolutiondate?: string | null;
    };
  }>;
};

type JiraBoardConfigurationResponse = {
  columnConfig?: {
    columns?: Array<{
      name?: string;
      statuses?: Array<{
        id?: number | string;
        name?: string;
      }>;
    }>;
  };
};

type JiraChangelogResponse = {
  values?: JiraChangelogEntry[];
  isLast?: boolean;
  startAt?: number;
  maxResults?: number;
  total?: number;
};

export class JiraService {
  constructor(_client?: Version3Client) {}

  resolveConfig(config?: JiraRuntimeConfig): ResolvedJiraConfig {
    return {
      host: config?.host?.trim() || env.JIRA_HOST,
      email: config?.email?.trim() || env.JIRA_EMAIL,
      apiToken: config?.apiToken?.trim() || env.JIRA_API_TOKEN,
      projectKey: config?.projectKey?.trim() || env.JIRA_PROJECT_KEY,
      defaultJql: config?.defaultJql?.trim() || env.JIRA_DEFAULT_JQL
    };
  }

  async getRecentIssues(
    jql?: string,
    maxResults = 20,
    config?: JiraRuntimeConfig
  ): Promise<JiraIssueSummary[]> {
    const resolvedConfig = this.resolveConfig(config);
    return this.searchIssues(jql ?? resolvedConfig.defaultJql, maxResults, [], resolvedConfig);
  }

  async searchIssues(
    jql: string,
    maxResults = 100,
    extraFields: string[] = [],
    config?: JiraRuntimeConfig
  ): Promise<JiraIssueSummary[]> {
    const fields = Array.from(
      new Set(['summary', 'status', 'issuetype', 'created', 'updated', 'resolutiondate', ...extraFields])
    );

    const data = await this.requestJiraJson<JiraSearchResponse>('/rest/api/3/search/jql', config, {
      method: 'POST',
      body: { jql, maxResults, fields },
      errorLabel: 'Jira search'
    });

    return (data.issues ?? []).map((issue) => this.mapJiraIssueSummary(issue, extraFields));
  }

  async getProjectOverview(config?: JiraRuntimeConfig) {
    const resolvedConfig = this.resolveConfig(config);
    const issues = await this.getRecentIssues(undefined, 20, resolvedConfig);

    return {
      projectKey: resolvedConfig.projectKey,
      fetchedAt: new Date().toISOString(),
      recentIssues: issues.length,
      statuses: issues.reduce<Record<string, number>>((acc, issue) => {
        acc[issue.status] = (acc[issue.status] ?? 0) + 1;
        return acc;
      }, {})
    };
  }

  async getBoardColumnStatuses(
    boardId: number,
    columnName: string,
    config?: JiraRuntimeConfig
  ): Promise<string[]> {
    const data = await this.getBoardConfiguration(boardId, config);
    const column = (data.columnConfig?.columns ?? []).find(
      (item) => item.name?.toLowerCase() === columnName.toLowerCase()
    );

    return (column?.statuses ?? []).flatMap((status) =>
      [status.id, status.name]
        .filter((value): value is string | number => value !== null && value !== undefined)
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0)
    );
  }

  async getBoardColumns(boardId: number, config?: JiraRuntimeConfig): Promise<string[]> {
    const data = await this.getBoardConfiguration(boardId, config);
    return (data.columnConfig?.columns ?? [])
      .map((column) => String(column.name ?? '').trim())
      .filter((name) => name.length > 0);
  }

  async getIssueChangelog(issueKey: string, config?: JiraRuntimeConfig): Promise<JiraChangelogEntry[]> {
    const values: JiraChangelogEntry[] = [];
    let startAt = 0;
    let isLast = false;

    while (!isLast) {
      const data = await this.requestJiraJson<JiraChangelogResponse>(
        `/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=100`,
        config,
        { errorLabel: 'Jira changelog' }
      );
      values.push(...(data.values ?? []));
      isLast = Boolean(data.isLast);
      startAt += data.maxResults ?? 100;
    }

    return values;
  }

  private async getBoardConfiguration(
    boardId: number,
    config?: JiraRuntimeConfig
  ): Promise<JiraBoardConfigurationResponse> {
    return this.requestJiraJson<JiraBoardConfigurationResponse>(
      `/rest/agile/1.0/board/${boardId}/configuration`,
      config,
      { errorLabel: 'Jira board configuration' }
    );
  }

  private async requestJiraJson<T>(
    path: string,
    config?: JiraRuntimeConfig,
    options?: {
      method?: 'GET' | 'POST';
      body?: unknown;
      errorLabel?: string;
    }
  ): Promise<T> {
    const resolvedConfig = this.resolveConfig(config);
    const auth = Buffer.from(`${resolvedConfig.email}:${resolvedConfig.apiToken}`).toString('base64');
    const method = options?.method ?? 'GET';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Basic ${auth}`
    };
    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${resolvedConfig.host}${path}`, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const label = options?.errorLabel ?? 'Jira request';
      throw new Error(`${label} failed with ${response.status}: ${errorBody}`);
    }

    return (await response.json()) as T;
  }

  private mapJiraIssueSummary(
    issue: NonNullable<JiraSearchResponse['issues']>[number],
    extraFields: string[]
  ): JiraIssueSummary {
    return {
      id: issue.id ?? '',
      key: issue.key ?? '',
      summary: String(issue.fields?.summary ?? ''),
      status: String(issue.fields?.status?.name ?? ''),
      issueType: String(issue.fields?.issuetype?.name ?? ''),
      createdAt: String(issue.fields?.created ?? ''),
      updatedAt: String(issue.fields?.updated ?? ''),
      resolvedAt: issue.fields?.resolutiondate ?? null,
      customFields: extraFields.reduce<Record<string, string | null>>((acc, fieldName) => {
        const value = issue.fields?.[fieldName];
        if (typeof value === 'string') {
          acc[fieldName] = value;
        } else if (value === null || value === undefined) {
          acc[fieldName] = null;
        } else {
          acc[fieldName] = String(value);
        }
        return acc;
      }, {})
    };
  }
}
