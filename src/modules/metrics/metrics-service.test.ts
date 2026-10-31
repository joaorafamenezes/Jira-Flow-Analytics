import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JiraService } from '../jira/jira-service';

process.env.NODE_ENV ??= 'test';
process.env.JIRA_HOST ??= 'https://example.atlassian.net';
process.env.JIRA_EMAIL ??= 'dev@example.com';
process.env.JIRA_API_TOKEN ??= 'test-token';
process.env.JIRA_PROJECT_KEY ??= 'KAN';
process.env.JIRA_DEFAULT_JQL ??= 'project = KAN ORDER BY updated DESC';
process.env.POSTGRES_URL ??= 'postgresql://postgres:postgres@localhost:5432/jira_flow_analytics';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';

describe('MetricsService behavioral pinning tests (source=jira)', () => {
  function createMockJiraService(): JiraService {
    const resolvedIssues = [
      {
        id: '1',
        key: 'KAN-1',
        summary: 'Deliver authentication',
        status: 'Em Produção',
        issueType: 'Story',
        createdAt: '2026-01-02T10:00:00.000Z',
        updatedAt: '2026-01-10T10:00:00.000Z',
        resolvedAt: '2026-01-10T10:00:00.000Z',
        customFields: {
          customfield_10000: '2026-01-04T10:00:00.000Z'
        }
      },
      {
        id: '2',
        key: 'KAN-2',
        summary: 'Fix login timeout',
        status: 'Em Produção',
        issueType: 'Bug',
        createdAt: '2026-01-05T10:00:00.000Z',
        updatedAt: '2026-01-09T10:00:00.000Z',
        resolvedAt: '2026-01-09T10:00:00.000Z',
        customFields: {
          customfield_10000: '2026-01-06T10:00:00.000Z'
        }
      }
    ];

    const wipIssue = {
      id: '3',
      key: 'KAN-3',
      summary: 'Build flow dashboard',
      status: 'Em Desenvolvimento',
      issueType: 'Story',
      createdAt: '2026-01-08T10:00:00.000Z',
      updatedAt: '2026-01-12T10:00:00.000Z',
      resolvedAt: null
    };

    class StubJiraService extends JiraService {
      override async getRecentIssues() {
        return [...resolvedIssues, wipIssue];
      }

      override async searchIssues() {
        return resolvedIssues;
      }

      override async getProjectOverview() {
        return {
          projectKey: 'KAN',
          fetchedAt: '2026-01-15T00:00:00.000Z',
          recentIssues: 3,
          statuses: { 'Em Produção': 2, 'Em Desenvolvimento': 1 }
        };
      }

      override async getBoardColumnStatuses(_boardId: number, columnName: string) {
        if (columnName.toLowerCase() === 'pronto para desenvolvimento') {
          return ['Pronto para Desenvolvimento'];
        }
        return ['Em Produção', 'Done'];
      }

      override async getBoardColumns() {
        return [
          'Pronto para Desenvolvimento',
          'Em Desenvolvimento',
          'Pronto para Testes',
          'Em Testes',
          'Em Deploy para Produção',
          'Done'
        ];
      }

      override async getIssueChangelog(issueKey: string) {
        if (issueKey === 'KAN-1') {
          return [
            {
              created: '2026-01-03T10:00:00.000Z',
              items: [{ field: 'status', fromString: 'Backlog', toString: 'Pronto para Desenvolvimento' }]
            },
            {
              created: '2026-01-05T10:00:00.000Z',
              items: [{ field: 'status', fromString: 'Pronto para Desenvolvimento', toString: 'Em Desenvolvimento' }]
            },
            {
              created: '2026-01-10T10:00:00.000Z',
              items: [{ field: 'status', fromString: 'Em Desenvolvimento', toString: 'Em Produção' }]
            }
          ];
        }
        if (issueKey === 'KAN-2') {
          return [
            {
              created: '2026-01-06T10:00:00.000Z',
              items: [{ field: 'status', fromString: 'Backlog', toString: 'Pronto para Desenvolvimento' }]
            },
            {
              created: '2026-01-09T10:00:00.000Z',
              items: [{ field: 'status', fromString: 'Pronto para Desenvolvimento', toString: 'Em Produção' }]
            }
          ];
        }
        return [
          {
            created: '2026-01-09T10:00:00.000Z',
            items: [{ field: 'status', fromString: 'Pronto para Desenvolvimento', toString: 'Em Desenvolvimento' }]
          },
          {
            created: '2026-01-11T10:00:00.000Z',
            items: [{ field: 'Flagged', fromString: null, toString: 'Impediment' }]
          }
        ];
      }
    }

    return new StubJiraService();
  }

  it('computes throughput from Jira issues by week', async () => {
    const { MetricsService } = await import('./metrics-service');
    const service = new MetricsService(createMockJiraService());

    const result = await service.getThroughputByPeriod({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      period: 'week',
      source: 'jira'
    });

    assert.equal(result.totalResolved, 2);
    assert.deepEqual(result.buckets, { '2026-01-05': 2 });
  });

  it('computes lead time across created, fieldDate, and boardColumn modes', async () => {
    const { MetricsService } = await import('./metrics-service');
    const service = new MetricsService(createMockJiraService());

    const createdResult = await service.getLeadTime({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      source: 'jira',
      startMode: 'created'
    });
    assert.equal(createdResult.issueCount, 2);
    assert.equal(createdResult.averageLeadTimeDays, 6);
    assert.equal(createdResult.medianLeadTimeDays, 6);

    const fieldResult = await service.getLeadTime({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      source: 'jira',
      startMode: 'fieldDate',
      startFieldId: 'customfield_10000'
    });
    assert.equal(fieldResult.issueCount, 2);
    assert.equal(fieldResult.averageLeadTimeDays, 4.5);

    const boardResult = await service.getLeadTime({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      source: 'jira',
      startMode: 'boardColumn',
      boardId: 1,
      startColumnName: 'Pronto para Desenvolvimento',
      endColumnName: 'Em Produção'
    });
    assert.equal(boardResult.issueCount, 2);
    assert.equal(boardResult.averageLeadTimeDays, 5);
  });

  it('computes flow dashboard and filter options from Jira issues', async () => {
    const { MetricsService } = await import('./metrics-service');
    const service = new MetricsService(createMockJiraService());

    const dashboard = await service.getFlowDashboard({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      source: 'jira',
      startMode: 'boardColumn',
      boardId: 1,
      startColumnName: 'Pronto para Desenvolvimento',
      endColumnName: 'Em Produção'
    });

    assert.equal(dashboard.summary.completedCount, 2);
    assert.equal(dashboard.summary.wipCount, 1);
    assert.equal(dashboard.summary.totalCount, 3);
    assert.equal(dashboard.summary.blockedItemsCount, 1);

    const filterOptions = await service.getFilterOptions({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      source: 'jira',
      startMode: 'boardColumn',
      boardId: 1
    });

    assert.deepEqual(filterOptions.issueTypes, ['Bug', 'Story']);
    assert.ok(filterOptions.leadTime.startColumns.includes('Pronto para Desenvolvimento'));
  });

  it('orders CFD statuses in workflow order with proper UTF-8 "Em Deploy para Produção"', async () => {
    const { MetricsService } = await import('./metrics-service');
    const service = new MetricsService(createMockJiraService());

    const dashboard = await service.getFlowDashboard({
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      source: 'mock'
    });

    assert.deepEqual(dashboard.charts.cumulativeFlow.statuses, [
      'Done',
      'Em Deploy para Produção',
      'Em Testes',
      'Pronto para Testes',
      'Em Desenvolvimento',
      'Pronto para Desenvolvimento'
    ]);
  });

  it('represents open blocked periods without endAt so currently blocked Jira WIP items have isBlocked=true and no 60s clock-skew heuristic', async () => {
    const { MetricsService } = await import('./metrics-service');

    // Even when a changelog has a closed block that ended 10 seconds ago, it must NOT be treated as currently blocked
    class CustomBlockedJiraService extends JiraService {
      override async getRecentIssues() {
        return [
          {
            id: '10',
            key: 'KAN-10',
            summary: 'Recently unblocked item',
            status: 'Em Desenvolvimento',
            issueType: 'Task',
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: new Date().toISOString(),
            resolvedAt: null
          },
          {
            id: '11',
            key: 'KAN-11',
            summary: 'Currently blocked item',
            status: 'Em Desenvolvimento',
            issueType: 'Task',
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: new Date().toISOString(),
            resolvedAt: null
          }
        ];
      }

      override async searchIssues() {
        return [];
      }

      override async getIssueChangelog(issueKey: string) {
        const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        if (issueKey === 'KAN-10') {
          return [
            {
              created: twoDaysAgo,
              items: [{ field: 'Flagged', fromString: null, toString: 'Impediment' }]
            },
            {
              created: tenSecondsAgo,
              items: [{ field: 'Flagged', fromString: 'Impediment', toString: '' }]
            }
          ];
        }
        return [
          {
            created: twoDaysAgo,
            items: [{ field: 'Flagged', fromString: null, toString: 'Impediment' }]
          }
        ];
      }
    }

    const customMetrics = new MetricsService(new CustomBlockedJiraService());
    const dashboard = await customMetrics.getFlowDashboard({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      source: 'jira',
      startMode: 'created',
      boardId: 0
    });

    // Only KAN-11 is currently blocked; KAN-10 was unblocked 10 seconds ago
    assert.equal(dashboard.summary.wipCount, 2);
    assert.equal(dashboard.summary.blockedItemsCount, 1);
    assert.equal(dashboard.summary.blockedItemsPercent, 50);
  });

  it('escapes JQL string values in getThroughputByPeriod so quotes and backslashes cannot corrupt JQL', async () => {
    const { MetricsService } = await import('./metrics-service');
    let capturedJql = '';

    class JqlCaptureJiraService extends JiraService {
      override async searchIssues(jql: string) {
        capturedJql = jql;
        return [];
      }
    }

    const service = new MetricsService(new JqlCaptureJiraService());
    await service.getThroughputByPeriod({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      period: 'day',
      source: 'jira',
      issueType: 'Story" OR project = "SECRET',
      assignee: 'user\\admin"test'
    });

    assert.ok(capturedJql.includes('issuetype = "Story\\" OR project = \\"SECRET"'));
    assert.ok(capturedJql.includes('assignee = "user\\\\admin\\"test"'));
  });
});
