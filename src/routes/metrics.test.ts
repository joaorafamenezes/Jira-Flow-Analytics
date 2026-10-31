import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.NODE_ENV ??= 'test';
process.env.JIRA_HOST ??= 'https://example.atlassian.net';
process.env.JIRA_EMAIL ??= 'dev@example.com';
process.env.JIRA_API_TOKEN ??= 'test-token';
process.env.JIRA_PROJECT_KEY ??= 'KAN';
process.env.JIRA_DEFAULT_JQL ??= 'project = KAN ORDER BY updated DESC';
process.env.POSTGRES_URL ??= 'postgresql://postgres:postgres@localhost:5432/jira_flow_analytics';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6379';

describe('HTTP routes behavioral pinning tests', () => {
  let app: FastifyInstance;

  before(async () => {
    const { buildApp } = await import('../app');
    app = await buildApp();
  });

  after(async () => {
    await app.close();
  });

  it('GET /health returns operational status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'jira-flow-analytics');
    assert.equal(typeof body.timestamp, 'string');
  });

  it('GET / returns API welcome payload', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/'
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, 'operational');
    assert.equal(body.endpoints.health, 'GET /health');
  });

  it('GET /settings/jira-defaults returns default Jira environment settings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/settings/jira-defaults'
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(typeof body.jiraHost, 'string');
    assert.equal(typeof body.jiraProjectKey, 'string');
  });

  it('GET /metrics/throughput validates required dates, period, and source', async () => {
    const missingDates = await app.inject({
      method: 'GET',
      url: '/metrics/throughput'
    });
    assert.equal(missingDates.statusCode, 400);

    const invalidPeriod = await app.inject({
      method: 'GET',
      url: '/metrics/throughput?startDate=2026-01-01&endDate=2026-01-31&period=year'
    });
    assert.equal(invalidPeriod.statusCode, 400);

    const invalidSource = await app.inject({
      method: 'GET',
      url: '/metrics/throughput?startDate=2026-01-01&endDate=2026-01-31&source=other'
    });
    assert.equal(invalidSource.statusCode, 400);
  });

  it('GET /metrics/throughput returns mock throughput with filters and periods', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/metrics/throughput?startDate=2026-01-01&endDate=2026-02-28&period=month&source=mock&squad=Core&issueType=Story&assignee=Joao&priority=High'
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.source, 'mock');
    assert.equal(body.period, 'month');
    assert.equal(body.totalResolved, 2);
    assert.deepEqual(body.buckets, {
      '2026-01': 1,
      '2026-02': 1
    });
    assert.equal(body.issues.length, 2);
  });

  it('GET /metrics/lead-time validates query parameters and returns mock lead time metrics', async () => {
    const missingDates = await app.inject({
      method: 'GET',
      url: '/metrics/lead-time'
    });
    assert.equal(missingDates.statusCode, 400);

    const invalidStartMode = await app.inject({
      method: 'GET',
      url: '/metrics/lead-time?startDate=2026-01-01&endDate=2026-01-31&source=mock&startMode=invalid'
    });
    assert.equal(invalidStartMode.statusCode, 400);

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/lead-time?startDate=2026-01-01&endDate=2026-01-31&source=mock&startMode=created&squad=Core'
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.source, 'mock');
    assert.equal(body.leadTimeStart.mode, 'created');
    assert.equal(body.issueCount, 3);
    assert.ok(body.averageLeadTimeDays > 0);
    assert.ok(body.medianLeadTimeDays > 0);
  });

  it('GET /metrics/flow-dashboard validates query parameters and returns mock dashboard', async () => {
    const missingDates = await app.inject({
      method: 'GET',
      url: '/metrics/flow-dashboard'
    });
    assert.equal(missingDates.statusCode, 400);

    const invalidThroughputPeriod = await app.inject({
      method: 'GET',
      url: '/metrics/flow-dashboard?startDate=2026-01-01&endDate=2026-03-31&source=mock&throughputPeriod=day'
    });
    assert.equal(invalidThroughputPeriod.statusCode, 400);

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/flow-dashboard?startDate=2026-01-01&endDate=2026-03-31&source=mock&throughputPeriod=month&leadTimePeriod=month&squad=Core'
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.source, 'mock');
    assert.ok(body.summary.completedCount > 0);
    assert.ok(body.summary.wipCount > 0);
    assert.equal(body.summary.totalCount, body.summary.completedCount + body.summary.wipCount);
    assert.ok(Array.isArray(body.insights));
    assert.ok(Array.isArray(body.charts.leadTimeScatterplot.items));
    assert.ok(Array.isArray(body.charts.cumulativeFlow.series));
  });

  it('GET /metrics/filter-options validates query parameters and returns filter options', async () => {
    const missingDates = await app.inject({
      method: 'GET',
      url: '/metrics/filter-options'
    });
    assert.equal(missingDates.statusCode, 400);

    const response = await app.inject({
      method: 'GET',
      url: '/metrics/filter-options?startDate=2026-01-01&endDate=2026-03-31&source=mock'
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.source, 'mock');
    assert.deepEqual(body.squads, ['Core', 'Growth', 'Platform']);
    assert.ok(body.issueTypes.includes('Story'));
    assert.ok(body.assignees.includes('Joao'));
    assert.ok(body.priorities.includes('High'));
  });

  it('rejects invalid calendar dates, invalid boardId, and invalid startMode on /metrics/filter-options at boundary', async () => {
    const invalidCalendarDate = await app.inject({
      method: 'GET',
      url: '/metrics/throughput?startDate=2026-02-30&endDate=2026-03-01&source=mock'
    });
    assert.equal(invalidCalendarDate.statusCode, 400);
    assert.equal(
      invalidCalendarDate.json().message,
      'Dates must be valid calendar dates in YYYY-MM-DD format'
    );

    const invalidFilterStartMode = await app.inject({
      method: 'GET',
      url: '/metrics/filter-options?startDate=2026-01-01&endDate=2026-01-31&source=mock&startMode=badMode'
    });
    assert.equal(invalidFilterStartMode.statusCode, 400);
    assert.equal(
      invalidFilterStartMode.json().message,
      'startMode must be created, fieldDate, or boardColumn'
    );

    const invalidBoardId = await app.inject({
      method: 'GET',
      url: '/metrics/lead-time?startDate=2026-01-01&endDate=2026-01-31&source=mock&boardId=-5'
    });
    assert.equal(invalidBoardId.statusCode, 400);
    assert.equal(invalidBoardId.json().message, 'boardId must be a positive integer');
  });

  it('POST /jobs/sync enqueues a job with deterministic idempotent jobId', async () => {
    let capturedName = '';
    let capturedOptions: { jobId?: string } | undefined;
    const originalAdd = app.jiraSyncQueue.add.bind(app.jiraSyncQueue);
    app.jiraSyncQueue.add = (async (name: string, _data: unknown, opts?: { jobId?: string }) => {
      capturedName = name;
      capturedOptions = opts;
      return { id: opts?.jobId ?? 'fallback-id' } as Awaited<ReturnType<typeof originalAdd>>;
    }) as typeof app.jiraSyncQueue.add;

    try {
      const first = await app.inject({
        method: 'POST',
        url: '/jobs/sync'
      });
      const second = await app.inject({
        method: 'POST',
        url: '/jobs/sync'
      });

      assert.equal(first.statusCode, 200);
      assert.equal(second.statusCode, 200);
      assert.equal(capturedName, 'sync-project');
      assert.ok(capturedOptions?.jobId?.startsWith('sync-project:'));
      assert.equal(first.json().jobId, second.json().jobId);
    } finally {
      app.jiraSyncQueue.add = originalAdd;
    }
  });
});
