import type { Version3Client } from 'jira.js';
import { env } from '../../config/env';

export type JiraRuntimeConfig = {
  host?: string;
  email?: string;
  apiToken?: string;
  projectKey?: string;
  defaultJql?: string;
};

type JiraIssueSummary = {
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
  values?: Array<{
    created?: string;
    items?: Array<{
      field?: string;
      from?: string | null;
      fromString?: string | null;
      to?: string | null;
      toString?: string | null;
    }>;
  }>;
  isLast?: boolean;
  startAt?: number;
  maxResults?: number;
  total?: number;
};

export class JiraService {
  constructor(private readonly client: Version3Client) {
    void this.client;
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
    const resolvedConfig = this.resolveConfig(config);
    const auth = Buffer.from(`${resolvedConfig.email}:${resolvedConfig.apiToken}`).toString('base64');
    const fields = Array.from(new Set([
      'summary',
      'status',
      'issuetype',
      'created',
      'updated',
      'resolutiondate',
      ...extraFields
    ]));

    const response = await fetch(`${resolvedConfig.host}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({
        jql,
        maxResults,
        fields
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Jira search failed with ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as JiraSearchResponse;

    return (data.issues ?? []).map((issue) => ({
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
    }));
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

  async getBoardColumnStatuses(boardId: number, columnName: string, config?: JiraRuntimeConfig): Promise<string[]> {
    const data = await this.getBoardConfiguration(boardId, config);
    const column = (data.columnConfig?.columns ?? []).find(
      (item) => item.name?.toLowerCase() === columnName.toLowerCase()
    );

    return (column?.statuses ?? [])
      .flatMap((status) => {
        const refs = [status.id, status.name]
          .filter((value): value is string | number => value !== null && value !== undefined)
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0);

        return refs;
      });
  }

  async getBoardColumns(boardId: number, config?: JiraRuntimeConfig): Promise<string[]> {
    const data = await this.getBoardConfiguration(boardId, config);
    return (data.columnConfig?.columns ?? [])
      .map((column) => String(column.name ?? '').trim())
      .filter((name) => name.length > 0);
  }

  async getIssueChangelog(issueKey: string, config?: JiraRuntimeConfig) {
    const resolvedConfig = this.resolveConfig(config);
    const auth = Buffer.from(`${resolvedConfig.email}:${resolvedConfig.apiToken}`).toString('base64');
    const values: NonNullable<JiraChangelogResponse['values']> = [];
    let startAt = 0;
    let isLast = false;

    while (!isLast) {
      const response = await fetch(`${resolvedConfig.host}/rest/api/3/issue/${issueKey}/changelog?startAt=${startAt}&maxResults=100`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${auth}`
        }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Jira changelog failed with ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as JiraChangelogResponse;
      values.push(...(data.values ?? []));
      isLast = Boolean(data.isLast);
      startAt += data.maxResults ?? 100;
    }

    return values;
  }

  private async getBoardConfiguration(boardId: number, config?: JiraRuntimeConfig) {
    const resolvedConfig = this.resolveConfig(config);
    const auth = Buffer.from(`${resolvedConfig.email}:${resolvedConfig.apiToken}`).toString('base64');
    const response = await fetch(`${resolvedConfig.host}/rest/agile/1.0/board/${boardId}/configuration`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Jira board configuration failed with ${response.status}: ${errorBody}`);
    }

    return (await response.json()) as JiraBoardConfigurationResponse;
  }

  private resolveConfig(config?: JiraRuntimeConfig) {
    return {
      host: config?.host ?? env.JIRA_HOST,
      email: config?.email ?? env.JIRA_EMAIL,
      apiToken: config?.apiToken ?? env.JIRA_API_TOKEN,
      projectKey: config?.projectKey ?? env.JIRA_PROJECT_KEY,
      defaultJql: config?.defaultJql ?? env.JIRA_DEFAULT_JQL
    };
  }
}
