import { env } from '../../config/env';
import type { JiraService } from '../jira/jira-service';
import { mockResolvedIssues } from './mock-throughput-data';

type ThroughputPeriod = 'day' | 'week' | 'month';
type ThroughputSource = 'jira' | 'mock';
type LeadTimeStartMode = 'created' | 'fieldDate' | 'boardColumn';

type ThroughputInput = {
  startDate: string;
  endDate: string;
  period: ThroughputPeriod;
  source?: ThroughputSource;
  issueType?: string;
  squad?: string;
  assignee?: string;
  priority?: string;
};

type LeadTimeInput = {
  startDate: string;
  endDate: string;
  source?: ThroughputSource;
  issueType?: string;
  squad?: string;
  assignee?: string;
  priority?: string;
  startMode?: LeadTimeStartMode;
  startFieldId?: string;
  startFieldName?: string;
  boardId?: number;
  startColumnName?: string;
  endColumnName?: string;
};

export class MetricsService {
  constructor(private readonly jiraService: JiraService) {}

  async getOverview() {
    const issues = await this.jiraService.getRecentIssues();
    const doneIssues = issues.filter((issue) => issue.status.toLowerCase() === 'done');
    const inProgressIssues = issues.filter((issue) => issue.status.toLowerCase().includes('progress'));

    return {
      generatedAt: new Date().toISOString(),
      recentIssueCount: issues.length,
      doneCount: doneIssues.length,
      inProgressCount: inProgressIssues.length,
      throughputSample: doneIssues.length
    };
  }

  async getThroughputByPeriod(input: ThroughputInput) {
    const issues = input.source === 'mock'
      ? this.getMockIssues(input)
      : await this.getResolvedIssuesFromJira(input);

    const buckets = issues.reduce<Record<string, number>>((acc, issue) => {
      if (!issue.resolvedAt) {
        return acc;
      }

      const bucket = this.getBucket(issue.resolvedAt, input.period);
      acc[bucket] = (acc[bucket] ?? 0) + 1;
      return acc;
    }, {});

    return {
      generatedAt: new Date().toISOString(),
      projectKey: env.JIRA_PROJECT_KEY,
      period: input.period,
      source: input.source ?? 'jira',
      startDate: input.startDate,
      endDate: input.endDate,
      filters: {
        issueType: input.issueType ?? null,
        squad: input.squad ?? null,
        assignee: input.assignee ?? null,
        priority: input.priority ?? null
      },
      totalResolved: issues.length,
      buckets,
      issues: issues.map((issue) => ({
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        status: issue.status,
        resolvedAt: issue.resolvedAt,
        assignee: 'assignee' in issue ? issue.assignee : undefined,
        squad: 'squad' in issue ? issue.squad : undefined,
        priority: 'priority' in issue ? issue.priority : undefined,
        labels: 'labels' in issue ? issue.labels : undefined
      }))
    };
  }

  async getLeadTime(input: LeadTimeInput) {
    const startMode = input.startMode ?? env.LEAD_TIME_START_MODE;
    const startFieldId = input.startFieldId ?? env.LEAD_TIME_START_FIELD_ID;
    const startFieldName = input.startFieldName ?? env.LEAD_TIME_START_FIELD_NAME;
    const boardId = input.boardId ?? env.LEAD_TIME_BOARD_ID;
    const startColumnName = input.startColumnName ?? env.LEAD_TIME_START_COLUMN_NAME;
    const endColumnName = input.endColumnName ?? env.LEAD_TIME_END_COLUMN_NAME;
    const leadTimeIssues = input.source === 'mock'
      ? this.getMockIssues(input)
          .map((issue) => {
            const startAt = this.getMockLeadTimeStart(issue.key, issue.resolvedAt ?? '', startMode);
            const endAt = this.getMockLeadTimeEnd(issue.resolvedAt ?? '');

            if (!endAt || !startAt) {
              return null;
            }

            return {
              key: issue.key,
              summary: issue.summary,
              issueType: issue.issueType,
              status: issue.status,
              startAt,
              endAt,
              leadTimeDays: this.diffInDays(startAt, endAt),
              assignee: issue.assignee,
              squad: issue.squad,
              priority: issue.priority,
              labels: issue.labels
            };
          })
          .filter((issue): issue is NonNullable<typeof issue> => issue !== null)
      : await this.getLeadTimeIssuesFromJira(input, startMode, startFieldId, boardId, startColumnName, endColumnName);

    const values = leadTimeIssues.map((issue) => issue.leadTimeDays).sort((a, b) => a - b);
    const total = values.reduce((sum, value) => sum + value, 0);
    const averageLeadTimeDays = values.length > 0 ? Number((total / values.length).toFixed(2)) : 0;
    const medianLeadTimeDays = values.length === 0
      ? 0
      : values.length % 2 === 1
        ? values[Math.floor(values.length / 2)]
        : Number((((values[(values.length / 2) - 1] + values[values.length / 2]) / 2)).toFixed(2));

    return {
      generatedAt: new Date().toISOString(),
      projectKey: env.JIRA_PROJECT_KEY,
      source: input.source ?? 'jira',
      startDate: input.startDate,
      endDate: input.endDate,
      leadTimeStart: {
        mode: startMode,
        fieldId: startMode === 'fieldDate' ? startFieldId : null,
        fieldName: startMode === 'fieldDate' ? startFieldName : null,
        boardId: startMode === 'boardColumn' ? boardId : null,
        columnName: startMode === 'boardColumn' ? startColumnName : null
      },
      leadTimeEnd: {
        mode: 'boardColumn',
        boardId,
        columnName: endColumnName
      },
      filters: {
        issueType: input.issueType ?? null,
        squad: input.squad ?? null,
        assignee: input.assignee ?? null,
        priority: input.priority ?? null
      },
      issueCount: leadTimeIssues.length,
      averageLeadTimeDays,
      medianLeadTimeDays,
      issues: leadTimeIssues
    };
  }

  private async getResolvedIssuesFromJira(input: ThroughputInput | LeadTimeInput) {
    const filters = [
      `project = ${env.JIRA_PROJECT_KEY}`,
      `resolutiondate >= "${input.startDate}"`,
      `resolutiondate < "${input.endDate}"`
    ];

    if (input.issueType) {
      filters.push(`issuetype = "${input.issueType}"`);
    }

    if (input.assignee) {
      filters.push(`assignee = "${input.assignee}"`);
    }

    const jql = `${filters.join(' AND ')} ORDER BY resolutiondate ASC`;
    const extraFields = 'startMode' in input && (input.startMode ?? env.LEAD_TIME_START_MODE) === 'fieldDate'
      ? [input.startFieldId ?? env.LEAD_TIME_START_FIELD_ID]
      : [];

    return this.jiraService.searchIssues(jql, 200, extraFields);
  }

  private getMockIssues(input: ThroughputInput | LeadTimeInput) {
    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T00:00:00.000Z`);

    return mockResolvedIssues.filter((issue) => {
      if (!issue.resolvedAt) {
        return false;
      }

      const resolvedAt = new Date(issue.resolvedAt);

      if (!(resolvedAt >= start && resolvedAt < end)) {
        return false;
      }

      if (input.issueType && issue.issueType !== input.issueType) {
        return false;
      }

      if (input.squad && issue.squad !== input.squad) {
        return false;
      }

      if (input.assignee && issue.assignee !== input.assignee) {
        return false;
      }

      if (input.priority && issue.priority !== input.priority) {
        return false;
      }

      return true;
    });
  }

  private getLeadTimeStartFromJiraIssue(
    issue: Awaited<ReturnType<JiraService['searchIssues']>>[number],
    startMode: LeadTimeStartMode,
    startFieldId: string
  ) {
    if (startMode === 'created') {
      return issue.createdAt;
    }

    if (startMode === 'boardColumn') {
      return null;
    }

    return issue.customFields?.[startFieldId] ?? null;
  }

  private getMockLeadTimeStart(key: string, resolvedAt: string, startMode: LeadTimeStartMode) {
    const resolvedDate = new Date(resolvedAt);
    const seed = this.getIssueSeed(key);
    const daysBack = startMode === 'created'
      ? 8 + (seed % 9)
      : 3 + (seed % 6);

    resolvedDate.setUTCDate(resolvedDate.getUTCDate() - daysBack);
    return resolvedDate.toISOString();
  }

  private getMockLeadTimeEnd(resolvedAt: string) {
    return resolvedAt || null;
  }

  private async getLeadTimeIssuesFromJira(
    input: LeadTimeInput,
    startMode: LeadTimeStartMode,
    startFieldId: string,
    boardId: number,
    startColumnName: string,
    endColumnName: string
  ) {
    const issues = await this.getResolvedIssuesFromJira(input);

    if (startMode !== 'boardColumn') {
      return issues
        .map((issue) => {
          const startAt = this.getLeadTimeStartFromJiraIssue(issue, startMode, startFieldId);

          if (!issue.resolvedAt || !startAt) {
            return null;
          }

          return {
            key: issue.key,
            summary: issue.summary,
            issueType: issue.issueType,
            status: issue.status,
            startAt,
            endAt: issue.resolvedAt,
            leadTimeDays: this.diffInDays(startAt, issue.resolvedAt),
            assignee: undefined,
            squad: undefined,
            priority: undefined,
            labels: undefined
          };
        })
        .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    }

    const [startStatuses, endStatuses] = await Promise.all([
      this.jiraService.getBoardColumnStatuses(boardId, startColumnName),
      this.jiraService.getBoardColumnStatuses(boardId, endColumnName)
    ]);

    const leadTimeIssues = await Promise.all(
      issues.map(async (issue) => {
        const changelog = await this.jiraService.getIssueChangelog(issue.key);
        const startAt = this.getFirstStatusTransitionAt(changelog, startStatuses);
        const endAt = this.getFirstStatusTransitionAt(changelog, endStatuses) ?? issue.resolvedAt;

        if (!startAt || !endAt) {
          return null;
        }

        const endDate = new Date(endAt);
        const rangeStart = new Date(`${input.startDate}T00:00:00.000Z`);
        const rangeEnd = new Date(`${input.endDate}T00:00:00.000Z`);

        if (!(endDate >= rangeStart && endDate < rangeEnd)) {
          return null;
        }

        return {
          key: issue.key,
          summary: issue.summary,
          issueType: issue.issueType,
          status: issue.status,
          startAt,
          endAt,
          leadTimeDays: this.diffInDays(startAt, endAt),
          assignee: undefined,
          squad: undefined,
          priority: undefined,
          labels: undefined
        };
      })
    );

    return leadTimeIssues.filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }

  private getFirstStatusTransitionAt(
    changelog: Awaited<ReturnType<JiraService['getIssueChangelog']>>,
    statusNames: string[]
  ) {
    const matches = new Set(statusNames.map((name) => name.toLowerCase()));

    for (const history of changelog) {
      const items = history.items ?? [];

      for (const item of items) {
        if (item.field !== 'status') {
          continue;
        }

        const toStatus = item.toString?.toLowerCase();
        if (toStatus && matches.has(toStatus)) {
          return history.created ?? null;
        }
      }
    }

    return null;
  }

  private getIssueSeed(key: string) {
    return key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  }

  private diffInDays(startAt: string, endAt: string) {
    const start = new Date(startAt).getTime();
    const end = new Date(endAt).getTime();
    const diff = end - start;
    return Number((diff / (1000 * 60 * 60 * 24)).toFixed(2));
  }

  private getBucket(dateValue: string, period: ThroughputPeriod) {
    const date = new Date(dateValue);

    if (period === 'day') {
      return date.toISOString().slice(0, 10);
    }

    if (period === 'month') {
      return date.toISOString().slice(0, 7);
    }

    const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = weekStart.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setUTCDate(weekStart.getUTCDate() + diff);
    return weekStart.toISOString().slice(0, 10);
  }
}
