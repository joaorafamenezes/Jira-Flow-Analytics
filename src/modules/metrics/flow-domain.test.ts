import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBlockedRateByPeriod,
  buildBlockedSummary,
  buildBlockedTimeByPeriod,
  buildCfdSeries,
  buildDashboardInsights,
  buildFlowEfficiency,
  buildFlowEfficiencyByPeriod,
  buildHistogram,
  buildJiraSearchJql,
  buildJiraStatusTransitions,
  buildLeadTimeAverageByPeriod,
  buildStageTimeAverage,
  buildTopAgingItems,
  computeLeadTimeStats,
  diffInDays,
  escapeJqlString,
  extractBlockedPeriods,
  extractDiscoveredStatuses,
  getBlockedOverlapDays,
  getCurrentBlockedDays,
  getDateRangeOverlapDays,
  getDefaultCfdStatuses,
  getEffectiveRangeEndDate,
  getFirstStatusTransitionAt,
  getFlowTransitionSlices,
  getInitialStatusFromChangelog,
  getPercentileValue,
  groupResolvedByPeriod,
  isItemCurrentlyBlocked,
  matchesIssueFilters,
  resolveFlowEfficiencyStatuses,
  withBlockedMetrics,
  type FlowItem
} from './flow-domain';

function makeFlowItem(overrides: Partial<FlowItem> = {}): FlowItem {
  return {
    key: 'KAN-1',
    summary: 'Sample item',
    issueType: 'Story',
    status: 'Em Desenvolvimento',
    squad: 'Core',
    assignee: 'Joao',
    priority: 'High',
    createdAt: '2026-01-01T00:00:00.000Z',
    resolvedAt: null,
    startAt: '2026-01-01T00:00:00.000Z',
    currentColumn: 'Em Desenvolvimento',
    currentColumnEnteredAt: '2026-01-02T00:00:00.000Z',
    transitions: [
      { status: 'Pronto para Desenvolvimento', at: '2026-01-01T00:00:00.000Z' },
      { status: 'Em Desenvolvimento', at: '2026-01-02T00:00:00.000Z' }
    ],
    blockedPeriods: [],
    blockedDays: 0,
    isBlocked: false,
    leadTimeDays: null,
    cycleTimeDays: null,
    agingDays: 5,
    isDone: false,
    ...overrides
  };
}

describe('flow-domain pure unit tests', () => {
  it('escapeJqlString and buildJiraSearchJql escape quotes and backslashes', () => {
    assert.equal(escapeJqlString('a"b\\c'), 'a\\"b\\\\c');
    const jql = buildJiraSearchJql({
      projectKey: 'KAN',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      issueType: 'Bug" OR 1=1',
      assignee: 'alice\\bob'
    });
    assert.equal(
      jql,
      'project = "KAN" AND resolutiondate >= "2026-01-01" AND resolutiondate < "2026-02-01" AND issuetype = "Bug\\" OR 1=1" AND assignee = "alice\\\\bob" ORDER BY resolutiondate ASC'
    );
  });

  it('getDateRangeOverlapDays and getBlockedOverlapDays compute exact overlap', () => {
    assert.equal(
      getDateRangeOverlapDays(
        '2026-01-02T00:00:00.000Z',
        '2026-01-06T00:00:00.000Z',
        '2026-01-04T00:00:00.000Z',
        '2026-01-10T00:00:00.000Z'
      ),
      2
    );
    assert.equal(
      getDateRangeOverlapDays(
        '2026-01-01T00:00:00.000Z',
        '2026-01-02T00:00:00.000Z',
        '2026-01-05T00:00:00.000Z',
        '2026-01-10T00:00:00.000Z'
      ),
      0
    );

    const referenceNow = new Date('2026-01-08T00:00:00.000Z');
    const item = makeFlowItem({
      blockedPeriods: [
        { startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-04T00:00:00.000Z' },
        { startAt: '2026-01-06T00:00:00.000Z' }
      ]
    });

    assert.equal(
      getBlockedOverlapDays(
        item,
        '2026-01-03T00:00:00.000Z',
        '2026-01-10T00:00:00.000Z',
        referenceNow
      ),
      3
    );
  });

  it('unifies blocked rate and blocked time by period with explicit referenceNow', () => {
    const referenceNow = new Date('2026-01-10T00:00:00.000Z');
    const items = [
      makeFlowItem({
        key: 'KAN-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        blockedPeriods: [{ startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-05T00:00:00.000Z' }]
      }),
      makeFlowItem({
        key: 'KAN-2',
        createdAt: '2026-01-01T00:00:00.000Z',
        blockedPeriods: []
      })
    ];

    const rate = buildBlockedRateByPeriod(items, '2026-01-01', '2026-01-08', 'week', referenceNow);
    const time = buildBlockedTimeByPeriod(items, '2026-01-01', '2026-01-08', 'week', referenceNow);

    assert.deepEqual(rate, { '2026-01-01': 50 });
    assert.deepEqual(time, { '2026-01-01': 1.5 });
  });

  it('computes transition slices, stage time average, and flow efficiency deterministically', () => {
    const referenceNow = new Date('2026-01-06T00:00:00.000Z');
    const item = makeFlowItem({
      transitions: [
        { status: 'Backlog', at: '2026-01-01T00:00:00.000Z' },
        { status: 'Pronto para Desenvolvimento', at: '2026-01-02T00:00:00.000Z' },
        { status: 'Em Desenvolvimento', at: '2026-01-03T00:00:00.000Z' }
      ]
    });

    const slices = getFlowTransitionSlices(item, 'Em Produção', referenceNow);
    assert.equal(slices.length, 2);
    assert.equal(slices[0]?.status, 'Pronto para Desenvolvimento');
    assert.equal(slices[0]?.durationDays, 1);
    assert.equal(slices[1]?.status, 'Em Desenvolvimento');
    assert.equal(slices[1]?.durationDays, 3);

    const stageAvg = buildStageTimeAverage([item], 'Em Produção', referenceNow);
    assert.deepEqual(stageAvg, {
      'Pronto para Desenvolvimento': 1,
      'Em Desenvolvimento': 3
    });

    const resolvedStatuses = resolveFlowEfficiencyStatuses(undefined, undefined, [item], 'Em Produção');
    assert.deepEqual(resolvedStatuses.activeStatuses, ['Em Desenvolvimento']);
    assert.deepEqual(resolvedStatuses.inactiveStatuses, ['Pronto para Desenvolvimento']);

    const efficiency = buildFlowEfficiency(
      [item],
      resolvedStatuses.activeStatuses,
      resolvedStatuses.inactiveStatuses,
      'Em Produção',
      referenceNow
    );
    assert.deepEqual(efficiency, {
      efficiencyPercent: 75,
      activeTimeAverageDays: 3,
      waitTimeAverageDays: 1
    });

    const trend = buildFlowEfficiencyByPeriod(
      [item],
      '2026-01-01',
      '2026-02-01',
      'month',
      resolvedStatuses.activeStatuses,
      resolvedStatuses.inactiveStatuses,
      'Em Produção',
      referenceNow
    );
    assert.deepEqual(trend, { '2026-01': 75 });
  });

  it('extracts open and closed blocked periods and computes blocked summary without clock-skew heuristics', () => {
    const referenceNow = new Date('2026-01-10T00:00:00.000Z');
    const changelog = [
      {
        created: '2026-01-02T00:00:00.000Z',
        items: [{ field: 'Flagged', fromString: null, toString: 'Impediment' }]
      },
      {
        created: '2026-01-04T00:00:00.000Z',
        items: [{ field: 'Flagged', fromString: 'Impediment', toString: '' }]
      },
      {
        created: '2026-01-07T00:00:00.000Z',
        items: [{ field: 'status', fromString: 'Em Desenvolvimento', toString: 'Blocked' }]
      }
    ];

    const openPeriods = extractBlockedPeriods(
      changelog,
      undefined,
      'Blocked',
      '2026-01-07T00:00:00.000Z'
    );
    assert.deepEqual(openPeriods, [
      { startAt: '2026-01-02T00:00:00.000Z', endAt: '2026-01-04T00:00:00.000Z' },
      { startAt: '2026-01-07T00:00:00.000Z' }
    ]);

    const wipItem = withBlockedMetrics(
      makeFlowItem({
        blockedPeriods: openPeriods
      })
    );
    assert.equal(wipItem.isBlocked, true);
    assert.equal(wipItem.blockedDays, 2);
    assert.equal(isItemCurrentlyBlocked(wipItem), true);
    assert.equal(getCurrentBlockedDays(wipItem, referenceNow), 3);

    const summary = buildBlockedSummary([wipItem], referenceNow);
    assert.deepEqual(summary, {
      blockedItemsPercent: 100,
      blockedItemsCount: 1,
      averageBlockedDays: 3
    });
  });

  it('matchesIssueFilters, groupResolvedByPeriod, extractDiscoveredStatuses, and getDefaultCfdStatuses', () => {
    const item = makeFlowItem({
      resolvedAt: '2026-01-15T10:00:00.000Z',
      isDone: true,
      currentColumn: 'Done',
      transitions: [
        { status: 'Pronto para Desenvolvimento', at: '2026-01-01T00:00:00.000Z' },
        { status: 'Em Deploy para Produção', at: '2026-01-14T00:00:00.000Z' },
        { status: 'Done', at: '2026-01-15T10:00:00.000Z' }
      ]
    });

    assert.equal(matchesIssueFilters(item, { squad: 'Core', issueType: 'Story' }), true);
    assert.equal(matchesIssueFilters(item, { squad: 'Growth' }), false);

    assert.deepEqual(groupResolvedByPeriod([item], 'month'), { '2026-01': 1 });
    assert.deepEqual(extractDiscoveredStatuses([item]), [
      'Done',
      'Em Deploy para Produção',
      'Pronto para Desenvolvimento'
    ]);
    assert.deepEqual(getDefaultCfdStatuses([item]), [
      'Done',
      'Em Deploy para Produção',
      'Pronto para Desenvolvimento'
    ]);

    const cfd = buildCfdSeries([item], '2026-01-01', '2026-01-16', getDefaultCfdStatuses([item]));
    assert.ok(cfd.length >= 2);
  });

  it('parses changelog transitions, lead time stats, histogram, top aging items, and insights', () => {
    const changelog = [
      {
        created: '2026-01-02T00:00:00.000Z',
        items: [{ field: 'status', fromString: 'Backlog', toString: 'Pronto para Desenvolvimento' }]
      },
      {
        created: '2026-01-05T00:00:00.000Z',
        items: [{ field: 'status', fromString: 'Pronto para Desenvolvimento', toString: 'Done' }]
      }
    ];

    assert.equal(getInitialStatusFromChangelog(changelog, 'Done'), 'Backlog');
    assert.equal(
      getFirstStatusTransitionAt(changelog, ['Pronto para Desenvolvimento']),
      '2026-01-02T00:00:00.000Z'
    );

    const transitions = buildJiraStatusTransitions(
      changelog,
      'Pronto para Desenvolvimento',
      '2026-01-02T00:00:00.000Z',
      'Done',
      '2026-01-05T00:00:00.000Z'
    );
    assert.equal(transitions.length, 2);

    assert.deepEqual(computeLeadTimeStats([2, 4, 6, 8]), {
      averageLeadTimeDays: 5,
      medianLeadTimeDays: 5
    });
    assert.equal(getPercentileValue([1, 2, 3, 4, 5], 85), 5);
    assert.equal(diffInDays('2026-01-01T00:00:00.000Z', '2026-01-03T12:00:00.000Z'), 2.5);
    assert.equal(
      getEffectiveRangeEndDate('2099-12-31', new Date('2026-05-10T15:00:00.000Z')),
      '2026-05-10'
    );

    const hist = buildHistogram([1.2, 1.8, 3.1]);
    assert.deepEqual(hist, [
      { label: '1-2d', count: 2 },
      { label: '3-4d', count: 1 }
    ]);

    const doneItem = makeFlowItem({
      isDone: true,
      resolvedAt: '2026-01-10T00:00:00.000Z',
      leadTimeDays: 4
    });
    assert.deepEqual(buildLeadTimeAverageByPeriod([doneItem], 'month'), {
      period: 'month',
      buckets: {
        '2026-01': { totalDays: 4, count: 1, averageDays: 4 }
      }
    });

    const topAging = buildTopAgingItems(
      [
        makeFlowItem({ key: 'KAN-1', agingDays: 3 }),
        makeFlowItem({ key: 'KAN-2', agingDays: 9 }),
        makeFlowItem({ key: 'KAN-3', agingDays: 15 })
      ],
      8,
      12
    );
    assert.equal(topAging[0]?.zone, 'critical');
    assert.equal(topAging[1]?.zone, 'warning');
    assert.equal(topAging[2]?.zone, 'normal');

    const insights = buildDashboardInsights({
      completedCount: 5,
      wipCount: 2,
      totalCount: 7,
      leadTimeP50: 3,
      leadTimeP85: 6,
      leadTimeP95: 9,
      agingP85: 5,
      agingP95: 8,
      weeklyThroughput: [2, 3]
    });
    assert.equal(insights.length, 4);
  });
});
