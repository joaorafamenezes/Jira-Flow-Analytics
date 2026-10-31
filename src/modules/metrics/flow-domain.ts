/**
 * Domain Glossary — Jira Flow Analytics
 *
 * - **Throughput**: Number of work items completed (`resolvedAt`) within a time bucket (`day`, `week`, or `month`).
 * - **Lead Time**: Elapsed time in days from commitment (`created`, `fieldDate`, or `boardColumn` entry) to completion (`resolvedAt` or `endColumnName` entry).
 * - **Cycle Time**: Elapsed time in days from active execution start to completion.
 * - **Flow Efficiency**: Ratio (`%`) of active work time to total tracked flow time (`active + waiting`), excluding backlog and post-delivery stages.
 * - **Blocked Period**: Time interval where an item is flagged as an impediment or sits in a blocked workflow status. Open blocked periods omit `endAt` (`endAt?: undefined`); closed periods record an ISO `endAt` timestamp (`endAt > startAt`).
 * - **Aging WIP**: Elapsed days a work-in-progress (`!isDone`) item has been active, segmented by P85 (`warning`) and P95 (`critical`) percentiles.
 * - **CFD (Cumulative Flow Diagram)**: Weekly time-series of cumulative item counts per workflow stage from `startDate` to `endDate`.
 */

import type { JiraChangelogEntry, JiraRuntimeConfig } from '../jira/jira-service';

export type ThroughputPeriod = 'day' | 'week' | 'month';
export type TrendPeriod = 'week' | 'month';
export type ThroughputSource = 'jira' | 'mock';
export type LeadTimeStartMode = 'created' | 'fieldDate' | 'boardColumn';

export type FlowTransition = {
  status: string;
  at: string;
};

export type FlowBlockedPeriod = {
  startAt: string;
  endAt?: string;
};

export type FlowItem = {
  key: string;
  summary: string;
  issueType: string;
  status: string;
  assignee?: string;
  squad?: string;
  priority?: string;
  labels?: string[];
  createdAt: string;
  resolvedAt: string | null;
  startAt: string;
  currentColumn: string;
  currentColumnEnteredAt: string;
  transitions: FlowTransition[];
  blockedPeriods: FlowBlockedPeriod[];
  blockedDays: number;
  isBlocked: boolean;
  leadTimeDays: number | null;
  cycleTimeDays: number | null;
  agingDays: number | null;
  isDone: boolean;
};

export type IssueFilterCriteria = {
  issueType?: string;
  squad?: string;
  assignee?: string;
  priority?: string;
};

export type ThroughputInput = IssueFilterCriteria & {
  startDate: string;
  endDate: string;
  period: ThroughputPeriod;
  source?: ThroughputSource;
  jiraConfig?: JiraRuntimeConfig;
};

export type LeadTimeInput = IssueFilterCriteria & {
  startDate: string;
  endDate: string;
  source?: ThroughputSource;
  startMode?: LeadTimeStartMode;
  startFieldId?: string;
  startFieldName?: string;
  boardId?: number;
  startColumnName?: string;
  endColumnName?: string;
  jiraConfig?: JiraRuntimeConfig;
};

export type FlowDashboardInput = LeadTimeInput & {
  throughputPeriod?: TrendPeriod;
  leadTimePeriod?: TrendPeriod;
  flowActiveStatuses?: string;
  flowInactiveStatuses?: string;
};

export type FilterOptionsInput = LeadTimeInput;

export type PeriodBucket = {
  label: string;
  startAt: string;
  endAt: string;
};

export const DEFAULT_CFD_STATUS_ORDER = [
  'Done',
  'Em Deploy para Produção',
  'Em Testes',
  'Pronto para Testes',
  'Em Desenvolvimento',
  'Pronto para Desenvolvimento'
] as const;

export function escapeJqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function shiftIsoDate(dateValue: string, days: number): string {
  const date = new Date(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function getExclusiveEndDate(endDate: string): string {
  return shiftIsoDate(`${endDate}T00:00:00.000Z`, 1).slice(0, 10);
}

export function getEffectiveRangeEndDate(endDate: string, referenceNow: Date = new Date()): string {
  const requestedEnd = new Date(`${endDate}T00:00:00.000Z`);
  const todayUtc = new Date(
    Date.UTC(referenceNow.getUTCFullYear(), referenceNow.getUTCMonth(), referenceNow.getUTCDate())
  );
  const effectiveEnd = requestedEnd.getTime() > todayUtc.getTime() ? todayUtc : requestedEnd;
  return effectiveEnd.toISOString().slice(0, 10);
}

export function buildJiraSearchJql(input: {
  projectKey: string;
  startDate: string;
  endDate: string;
  issueType?: string;
  assignee?: string;
}): string {
  const exclusiveEndDate = getExclusiveEndDate(input.endDate);
  const filters = [
    `project = "${escapeJqlString(input.projectKey)}"`,
    `resolutiondate >= "${escapeJqlString(input.startDate)}"`,
    `resolutiondate < "${escapeJqlString(exclusiveEndDate)}"`
  ];

  if (input.issueType) {
    filters.push(`issuetype = "${escapeJqlString(input.issueType)}"`);
  }

  if (input.assignee) {
    filters.push(`assignee = "${escapeJqlString(input.assignee)}"`);
  }

  return `${filters.join(' AND ')} ORDER BY resolutiondate ASC`;
}

export function diffInDays(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const diff = end - start;
  return Number((diff / (1000 * 60 * 60 * 24)).toFixed(2));
}

export function getDateRangeOverlapDays(
  startAt: string,
  endAt: string,
  rangeStartAt: string,
  rangeEndAt: string
): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const rangeStart = new Date(rangeStartAt).getTime();
  const rangeEnd = new Date(rangeEndAt).getTime();
  const overlapStart = Math.max(start, rangeStart);
  const overlapEnd = Math.min(end, rangeEnd);

  if (overlapEnd <= overlapStart) {
    return 0;
  }

  return Number(((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)).toFixed(2));
}

export function getBlockedOverlapDays(
  item: Pick<FlowItem, 'blockedPeriods'>,
  bucketStartAt: string,
  bucketEndAt: string,
  referenceNow: Date = new Date()
): number {
  const fallbackEndAt = referenceNow.toISOString();
  const total = item.blockedPeriods.reduce((sum, period) => {
    return sum + getDateRangeOverlapDays(
      period.startAt,
      period.endAt ?? fallbackEndAt,
      bucketStartAt,
      bucketEndAt
    );
  }, 0);

  return Number(total.toFixed(2));
}

export function getBucket(dateValue: string, period: ThroughputPeriod): string {
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

export function groupResolvedByPeriod(
  items: ReadonlyArray<{ resolvedAt: string | null }>,
  period: ThroughputPeriod
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    if (!item.resolvedAt) {
      return acc;
    }

    const bucket = getBucket(item.resolvedAt, period);
    acc[bucket] = (acc[bucket] ?? 0) + 1;
    return acc;
  }, {});
}

export function matchesIssueFilters(
  item: {
    issueType?: string;
    squad?: string;
    assignee?: string;
    priority?: string;
  },
  criteria: IssueFilterCriteria
): boolean {
  if (criteria.issueType && item.issueType !== criteria.issueType) {
    return false;
  }
  if (criteria.squad && item.squad !== criteria.squad) {
    return false;
  }
  if (criteria.assignee && item.assignee !== criteria.assignee) {
    return false;
  }
  if (criteria.priority && item.priority !== criteria.priority) {
    return false;
  }
  return true;
}

export function getUniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function extractDiscoveredStatuses(
  flowItems: ReadonlyArray<Pick<FlowItem, 'currentColumn' | 'transitions'>>
): string[] {
  return getUniqueSorted([
    ...flowItems.map((item) => item.currentColumn),
    ...flowItems.flatMap((item) => item.transitions.map((transition) => transition.status))
  ]);
}

export function getPercentileValue(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return Number(sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))].toFixed(2));
}

export function getVariation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) {
    return 0;
  }

  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance) / average;
}

export function buildHistogram(values: number[]): Array<{ label: string; count: number }> {
  if (values.length === 0) {
    return [];
  }

  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  const bins: Array<{ label: string; count: number }> = [];

  for (let start = min; start <= max; start += 1) {
    const end = start + 1;
    const count = values.filter((value) => value >= start && value < end).length;
    bins.push({
      label: `${start}-${end}d`,
      count
    });
  }

  return bins.filter((bin) => bin.count > 0);
}

export function buildLeadTimeAverageByPeriod(flowItems: FlowItem[], period: TrendPeriod) {
  const buckets = flowItems
    .filter((item) => item.isDone && item.resolvedAt && item.leadTimeDays !== null)
    .reduce<Record<string, { totalDays: number; count: number; averageDays: number }>>((acc, item) => {
      const bucket = getBucket(item.resolvedAt!, period);
      const current = acc[bucket] ?? { totalDays: 0, count: 0, averageDays: 0 };
      current.totalDays += item.leadTimeDays!;
      current.count += 1;
      current.averageDays = Number((current.totalDays / current.count).toFixed(2));
      acc[bucket] = current;
      return acc;
    }, {});

  return {
    period,
    buckets
  };
}

export function isExcludedFromFlowTime(status: string, endColumnName?: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (!normalized || normalized === 'done') {
    return true;
  }

  if (endColumnName && normalized === endColumnName.trim().toLowerCase()) {
    return true;
  }

  if (/^(product\s+)?backlog$/.test(normalized) || /^produto\s+backlog$/.test(normalized)) {
    return true;
  }

  return /^em\s+produ[cç][aã]o$/.test(normalized);
}

export function isWaitingStatus(status: string): boolean {
  if (isExcludedFromFlowTime(status)) {
    return false;
  }

  if (/^em\s+/i.test(status)) {
    return false;
  }

  return /(pronto|ready|aguard|wait|todo|to do|selecionad)/i.test(status);
}

export function parseStatuses(value: string | undefined, defaults: string[]): string[] {
  const parsed = (value ?? '')
    .split(/\r?\n|,|;/)
    .map((status) => status.trim())
    .filter((status) => status.length > 0);

  return parsed.length > 0 ? parsed : defaults;
}

export function resolveFlowEfficiencyStatuses(
  activeStatusesInput: string | undefined,
  inactiveStatusesInput: string | undefined,
  flowItems: ReadonlyArray<Pick<FlowItem, 'currentColumn' | 'transitions'>>,
  endColumnName?: string
) {
  const providedActiveStatuses = parseStatuses(activeStatusesInput, [])
    .filter((status) => !isExcludedFromFlowTime(status, endColumnName));
  const providedInactiveStatuses = parseStatuses(inactiveStatusesInput, [])
    .filter((status) => !isExcludedFromFlowTime(status, endColumnName));
  const discoveredStatuses = extractDiscoveredStatuses(flowItems)
    .filter((status) => !isExcludedFromFlowTime(status, endColumnName));

  if (providedActiveStatuses.length > 0 || providedInactiveStatuses.length > 0) {
    const explicitStatuses = new Set(
      [...providedActiveStatuses, ...providedInactiveStatuses].map((status) => status.toLowerCase())
    );
    const inferredActiveStatuses = discoveredStatuses.filter(
      (status) => !explicitStatuses.has(status.toLowerCase()) && !isWaitingStatus(status)
    );
    const inferredInactiveStatuses = discoveredStatuses.filter(
      (status) => !explicitStatuses.has(status.toLowerCase()) && isWaitingStatus(status)
    );

    return {
      activeStatuses: [...providedActiveStatuses, ...inferredActiveStatuses],
      inactiveStatuses: [...providedInactiveStatuses, ...inferredInactiveStatuses]
    };
  }

  return {
    activeStatuses: discoveredStatuses.filter((status) => !isWaitingStatus(status)),
    inactiveStatuses: discoveredStatuses.filter((status) => isWaitingStatus(status))
  };
}

export type TransitionSlice = {
  status: string;
  startAt: string;
  endAt: string;
  durationDays: number;
};

export function getFlowTransitionSlices(
  item: Pick<FlowItem, 'transitions' | 'isDone' | 'resolvedAt'>,
  endColumnName?: string,
  referenceNow: Date = new Date()
): TransitionSlice[] {
  const nowIso = referenceNow.toISOString();
  const transitions = [...item.transitions].sort((a, b) => a.at.localeCompare(b.at));
  const slices: TransitionSlice[] = [];

  transitions.forEach((transition, index) => {
    const nextTransition = transitions[index + 1];
    const endAt = nextTransition?.at ?? (item.isDone ? item.resolvedAt : nowIso);

    if (!endAt || isExcludedFromFlowTime(transition.status, endColumnName)) {
      return;
    }

    const durationDays = diffInDays(transition.at, endAt);
    if (durationDays < 0) {
      return;
    }

    slices.push({
      status: transition.status,
      startAt: transition.at,
      endAt,
      durationDays
    });
  });

  return slices;
}

export function buildStageTimeAverage(
  flowItems: FlowItem[],
  endColumnName?: string,
  referenceNow: Date = new Date()
): Record<string, number> {
  const stageAccumulator = flowItems.reduce<Record<string, { totalDays: number; count: number }>>((acc, item) => {
    getFlowTransitionSlices(item, endColumnName, referenceNow).forEach((slice) => {
      const current = acc[slice.status] ?? { totalDays: 0, count: 0 };
      current.totalDays += slice.durationDays;
      current.count += 1;
      acc[slice.status] = current;
    });

    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(stageAccumulator).map(([status, value]) => [
      status,
      Number((value.totalDays / Math.max(value.count, 1)).toFixed(2))
    ])
  );
}

export function buildFlowEfficiency(
  flowItems: FlowItem[],
  activeStatuses: string[],
  inactiveStatuses: string[],
  endColumnName?: string,
  referenceNow: Date = new Date()
) {
  const active = new Set(activeStatuses.map((status) => status.toLowerCase()));
  const inactive = new Set(inactiveStatuses.map((status) => status.toLowerCase()));
  let totalActiveDays = 0;
  let totalWaitDays = 0;
  let countedItems = 0;

  flowItems.forEach((item) => {
    let itemActiveDays = 0;
    let itemWaitDays = 0;

    getFlowTransitionSlices(item, endColumnName, referenceNow).forEach((slice) => {
      const normalizedStatus = slice.status.toLowerCase();
      if (active.has(normalizedStatus)) {
        itemActiveDays += slice.durationDays;
      } else if (inactive.has(normalizedStatus)) {
        itemWaitDays += slice.durationDays;
      }
    });

    if (itemActiveDays > 0 || itemWaitDays > 0) {
      totalActiveDays += itemActiveDays;
      totalWaitDays += itemWaitDays;
      countedItems += 1;
    }
  });

  const totalTrackedDays = totalActiveDays + totalWaitDays;
  return {
    efficiencyPercent: totalTrackedDays === 0 ? 0 : Number(((totalActiveDays / totalTrackedDays) * 100).toFixed(2)),
    activeTimeAverageDays: countedItems === 0 ? 0 : Number((totalActiveDays / countedItems).toFixed(2)),
    waitTimeAverageDays: countedItems === 0 ? 0 : Number((totalWaitDays / countedItems).toFixed(2))
  };
}

export function getPeriodBuckets(startDate: string, endDate: string, period: TrendPeriod): PeriodBucket[] {
  const buckets: PeriodBucket[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current < end) {
    const bucketStart = new Date(current);
    const bucketEnd = new Date(current);
    if (period === 'month') {
      bucketEnd.setUTCMonth(bucketEnd.getUTCMonth() + 1);
    } else {
      bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 7);
    }

    buckets.push({
      label: period === 'month'
        ? bucketStart.toISOString().slice(0, 7)
        : bucketStart.toISOString().slice(0, 10),
      startAt: bucketStart.toISOString(),
      endAt: bucketEnd.toISOString()
    });

    current.setTime(bucketEnd.getTime());
  }

  return buckets;
}

export function buildFlowEfficiencyByPeriod(
  flowItems: FlowItem[],
  startDate: string,
  endDate: string,
  period: TrendPeriod,
  activeStatuses: string[],
  inactiveStatuses: string[],
  endColumnName?: string,
  referenceNow: Date = new Date()
): Record<string, number> {
  const active = new Set(activeStatuses.map((status) => status.toLowerCase()));
  const inactive = new Set(inactiveStatuses.map((status) => status.toLowerCase()));
  const buckets = getPeriodBuckets(startDate, endDate, period);
  const itemSlices = flowItems.map((item) => getFlowTransitionSlices(item, endColumnName, referenceNow));

  return Object.fromEntries(
    buckets.map((bucket) => {
      let totalActiveDays = 0;
      let totalWaitDays = 0;

      itemSlices.forEach((slices) => {
        slices.forEach((slice) => {
          const overlapDays = getDateRangeOverlapDays(
            slice.startAt,
            slice.endAt,
            bucket.startAt,
            bucket.endAt
          );

          if (overlapDays <= 0) {
            return;
          }

          const normalizedStatus = slice.status.toLowerCase();
          if (active.has(normalizedStatus)) {
            totalActiveDays += overlapDays;
          } else if (inactive.has(normalizedStatus)) {
            totalWaitDays += overlapDays;
          }
        });
      });

      const totalTrackedDays = totalActiveDays + totalWaitDays;
      return [
        bucket.label,
        totalTrackedDays === 0 ? 0 : Number(((totalActiveDays / totalTrackedDays) * 100).toFixed(2))
      ];
    })
  );
}

export function isItemCurrentlyBlocked(item: Pick<FlowItem, 'isDone' | 'blockedPeriods'>): boolean {
  if (item.isDone) {
    return false;
  }

  return item.blockedPeriods.some((period) => !period.endAt);
}

export function getCurrentBlockedDays(
  item: Pick<FlowItem, 'blockedPeriods'>,
  referenceNow: Date = new Date()
): number {
  const currentPeriod = [...item.blockedPeriods]
    .reverse()
    .find((period) => !period.endAt);

  if (!currentPeriod) {
    return 0;
  }

  return Math.max(0, diffInDays(currentPeriod.startAt, referenceNow.toISOString()));
}

export function withBlockedMetrics(item: FlowItem): FlowItem {
  const blockedDays = item.blockedPeriods.reduce((sum, period) => {
    if (!period.endAt) {
      return sum;
    }

    return sum + Math.max(0, diffInDays(period.startAt, period.endAt));
  }, 0);

  return {
    ...item,
    blockedDays: Number(blockedDays.toFixed(2)),
    isBlocked: isItemCurrentlyBlocked(item)
  };
}

export function buildBlockedSummary(wipItems: FlowItem[], referenceNow: Date = new Date()) {
  if (wipItems.length === 0) {
    return {
      blockedItemsPercent: 0,
      blockedItemsCount: 0,
      averageBlockedDays: 0
    };
  }

  const blockedItems = wipItems.filter((item) => isItemCurrentlyBlocked(item));
  const totalBlockedDays = blockedItems.reduce(
    (sum, item) => sum + getCurrentBlockedDays(item, referenceNow),
    0
  );

  return {
    blockedItemsPercent: Number(((blockedItems.length / wipItems.length) * 100).toFixed(2)),
    blockedItemsCount: blockedItems.length,
    averageBlockedDays: blockedItems.length === 0 ? 0 : Number((totalBlockedDays / blockedItems.length).toFixed(2))
  };
}

export function itemOverlapsBucket(
  item: Pick<FlowItem, 'createdAt' | 'resolvedAt'>,
  bucketStartAt: string,
  bucketEndAt: string,
  referenceNow: Date = new Date()
): boolean {
  const itemStart = new Date(item.createdAt).getTime();
  const itemEnd = new Date(item.resolvedAt ?? referenceNow.toISOString()).getTime();
  const bucketStart = new Date(bucketStartAt).getTime();
  const bucketEnd = new Date(bucketEndAt).getTime();

  return itemStart < bucketEnd && itemEnd >= bucketStart;
}

function mapBlockedPeriodBuckets(
  flowItems: FlowItem[],
  startDate: string,
  endDate: string,
  period: TrendPeriod,
  referenceNow: Date,
  computeBucketValue: (activeItems: FlowItem[], bucket: PeriodBucket) => number
): Record<string, number> {
  const buckets = getPeriodBuckets(startDate, endDate, period);

  return Object.fromEntries(
    buckets.map((bucket) => {
      const activeItems = flowItems.filter((item) =>
        itemOverlapsBucket(item, bucket.startAt, bucket.endAt, referenceNow)
      );
      const value = activeItems.length === 0 ? 0 : computeBucketValue(activeItems, bucket);
      return [bucket.label, value];
    })
  );
}

export function buildBlockedRateByPeriod(
  flowItems: FlowItem[],
  startDate: string,
  endDate: string,
  period: TrendPeriod,
  referenceNow: Date = new Date()
): Record<string, number> {
  return mapBlockedPeriodBuckets(
    flowItems,
    startDate,
    endDate,
    period,
    referenceNow,
    (activeItems, bucket) => {
      const blockedItems = activeItems.filter(
        (item) => getBlockedOverlapDays(item, bucket.startAt, bucket.endAt, referenceNow) > 0
      );
      return Number(((blockedItems.length / activeItems.length) * 100).toFixed(2));
    }
  );
}

export function buildBlockedTimeByPeriod(
  flowItems: FlowItem[],
  startDate: string,
  endDate: string,
  period: TrendPeriod,
  referenceNow: Date = new Date()
): Record<string, number> {
  return mapBlockedPeriodBuckets(
    flowItems,
    startDate,
    endDate,
    period,
    referenceNow,
    (activeItems, bucket) => {
      const totalBlockedDays = activeItems.reduce(
        (sum, item) => sum + getBlockedOverlapDays(item, bucket.startAt, bucket.endAt, referenceNow),
        0
      );
      return Number((totalBlockedDays / activeItems.length).toFixed(2));
    }
  );
}

export function getFlowItemStatusAtDate(
  item: Pick<FlowItem, 'createdAt' | 'transitions' | 'currentColumn'>,
  snapshotAt: string
): string | null {
  const snapshot = new Date(snapshotAt).getTime();
  const created = new Date(item.createdAt).getTime();

  if (created > snapshot) {
    return null;
  }

  let currentStatus = item.transitions[0]?.status ?? item.currentColumn;
  for (const transition of item.transitions) {
    if (new Date(transition.at).getTime() <= snapshot) {
      currentStatus = transition.status;
    }
  }

  return currentStatus;
}

export function getWeekSeries(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 7);
  }

  const endLabel = end.toISOString().slice(0, 10);
  if (dates.length === 0 || dates[dates.length - 1] !== endLabel) {
    dates.push(endLabel);
  }

  return dates;
}

export function buildCfdSeries(
  flowItems: FlowItem[],
  startDate: string,
  endDate: string,
  statuses: string[]
) {
  const weeks = getWeekSeries(startDate, endDate);

  return weeks.map((week) => {
    const snapshotAt = `${week}T23:59:59.000Z`;
    const counts = statuses.reduce<Record<string, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});

    flowItems.forEach((item) => {
      const statusAtDate = getFlowItemStatusAtDate(item, snapshotAt);
      if (statusAtDate) {
        counts[statusAtDate] = (counts[statusAtDate] ?? 0) + 1;
      }
    });

    return {
      bucket: week,
      counts
    };
  });
}

export function getDefaultCfdStatuses(
  flowItems: ReadonlyArray<Pick<FlowItem, 'currentColumn' | 'transitions'>>
): string[] {
  const discoveredStatuses = extractDiscoveredStatuses(flowItems);

  return [
    ...DEFAULT_CFD_STATUS_ORDER.filter((status) => discoveredStatuses.includes(status)),
    ...discoveredStatuses.filter(
      (status) => !DEFAULT_CFD_STATUS_ORDER.includes(status as (typeof DEFAULT_CFD_STATUS_ORDER)[number])
    )
  ];
}

export function buildDashboardInsights(input: {
  completedCount: number;
  wipCount: number;
  totalCount: number;
  leadTimeP50: number;
  leadTimeP85: number;
  leadTimeP95: number;
  agingP85: number;
  agingP95: number;
  weeklyThroughput: number[];
}) {
  const throughputVariation = getVariation(input.weeklyThroughput);
  const criticalAgingCount = input.agingP95 === 0
    ? 0
    : input.weeklyThroughput.length === 0
      ? 0
      : input.wipCount > 0
        ? Math.max(0, Math.round(input.wipCount * 0.2))
        : 0;

  return [
    {
      tone: 'positive',
      title: 'Previsibilidade de servico',
      body: `Com P50 de ${input.leadTimeP50}d, P85 de ${input.leadTimeP85}d e P95 de ${input.leadTimeP95}d, o fluxo mostra uma faixa clara de previsibilidade para combinacao de prazos.`
    },
    {
      tone: 'positive',
      title: 'Liquidez do fluxo',
      body: `${input.completedCount} itens concluidos contra ${input.wipCount} em andamento indicam um sistema ativo. Use o P85 para prometer prazos com mais seguranca.`
    },
    {
      tone: throughputVariation > 0.45 ? 'warning' : 'positive',
      title: throughputVariation > 0.45 ? 'Throughput instavel' : 'Cadencia de entrega saudavel',
      body: throughputVariation > 0.45
        ? 'A variacao semanal de entregas esta alta, sugerindo lotes e semanas de ociosidade alternadas. Vale reduzir batching e equilibrar a entrada.'
        : 'A serie semanal de throughput esta relativamente estavel, o que ajuda a sustentar previsibilidade de entrega.'
    },
    {
      tone: criticalAgingCount > 0 ? 'warning' : 'positive',
      title: criticalAgingCount > 0 ? `${criticalAgingCount} itens com envelhecimento critico` : 'WIP sob controle',
      body: criticalAgingCount > 0
        ? `Existem itens em andamento acima do P95 de aging (${input.agingP95}d). Eles merecem atencao imediata na reuniao de fluxo.`
        : `Os itens em andamento permanecem abaixo do P95 de aging (${input.agingP95}d), sinalizando que o WIP esta sob controle.`
    }
  ];
}

export function isBlockedStatus(status: string): boolean {
  return /(blocked|bloquead|impediment|on hold|waiting|aguardando|dependenc)/i.test(status);
}

export function getBlockedFieldState(
  field: string | undefined,
  toString: string | null | undefined,
  to: string | null | undefined
): boolean | null {
  const normalizedField = String(field ?? '').toLowerCase();
  if (!/(flag|impediment|block)/.test(normalizedField)) {
    return null;
  }

  const targetValue = String(toString ?? to ?? '').trim().toLowerCase();
  if (!targetValue) {
    return false;
  }

  if (/(impediment|blocked|flag|true|yes|sim)/.test(targetValue)) {
    return true;
  }

  return null;
}

export function extractBlockedPeriods(
  changelog: ReadonlyArray<JiraChangelogEntry>,
  closedEndAt: string | undefined,
  currentStatus: string,
  currentColumnEnteredAt: string
): FlowBlockedPeriod[] {
  const sorted = [...changelog].sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
  const periods: FlowBlockedPeriod[] = [];
  let flaggedBlocked = false;
  let statusBlocked = false;
  let openStartAt: string | null = null;

  sorted.forEach((history) => {
    const createdAt = history.created ?? closedEndAt ?? currentColumnEnteredAt;
    let nextFlaggedBlocked = flaggedBlocked;
    let nextStatusBlocked = statusBlocked;

    (history.items ?? []).forEach((item) => {
      const flaggedState = getBlockedFieldState(item.field, item.toString, item.to);
      if (flaggedState !== null) {
        nextFlaggedBlocked = flaggedState;
      }

      if (item.field === 'status') {
        const nextStatus = item.toString ?? item.to ?? null;
        nextStatusBlocked = nextStatus ? isBlockedStatus(nextStatus) : false;
      }
    });

    const wasBlocked = flaggedBlocked || statusBlocked;
    const isBlocked = nextFlaggedBlocked || nextStatusBlocked;

    if (!wasBlocked && isBlocked) {
      openStartAt = createdAt;
    }

    if (wasBlocked && !isBlocked && openStartAt) {
      periods.push({ startAt: openStartAt, endAt: createdAt });
      openStartAt = null;
    }

    flaggedBlocked = nextFlaggedBlocked;
    statusBlocked = nextStatusBlocked;
  });

  const currentStateBlocked = flaggedBlocked || statusBlocked || isBlockedStatus(currentStatus);
  if (currentStateBlocked) {
    const startAt = openStartAt ?? currentColumnEnteredAt;
    if (startAt) {
      periods.push(closedEndAt ? { startAt, endAt: closedEndAt } : { startAt });
    }
  }

  return periods.filter(
    (period) => !period.endAt || new Date(period.endAt).getTime() > new Date(period.startAt).getTime()
  );
}

export function getFirstStatusTransitionAt(
  changelog: ReadonlyArray<JiraChangelogEntry>,
  statusReferences: string[]
): string | null {
  const matches = new Set(statusReferences.map((reference) => reference.toLowerCase()));

  for (const history of changelog) {
    for (const item of history.items ?? []) {
      if (item.field !== 'status') {
        continue;
      }

      const candidates = [item.to, item.toString]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());

      if (candidates.some((candidate) => matches.has(candidate))) {
        return history.created ?? null;
      }
    }
  }

  return null;
}

export function buildJiraStatusTransitions(
  changelog: ReadonlyArray<JiraChangelogEntry>,
  initialStatus: string,
  initialAt: string,
  finalStatus?: string,
  finalAt?: string
): FlowTransition[] {
  const transitions: FlowTransition[] = [
    {
      status: initialStatus,
      at: initialAt
    }
  ];

  const initialTimestamp = new Date(initialAt).getTime();

  [...changelog]
    .sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''))
    .forEach((history) => {
      const createdAt = history.created;
      if (!createdAt || new Date(createdAt).getTime() < initialTimestamp) {
        return;
      }

      (history.items ?? []).forEach((item) => {
        const nextStatus = item.field === 'status' ? (item.toString ?? item.to) : null;
        const lastTransition = transitions[transitions.length - 1];
        if (nextStatus && lastTransition?.status !== nextStatus) {
          transitions.push({ status: nextStatus, at: createdAt });
        }
      });
    });

  if (finalStatus && finalAt) {
    const lastTransition = transitions[transitions.length - 1];
    if (!lastTransition || lastTransition.status !== finalStatus || lastTransition.at !== finalAt) {
      transitions.push({ status: finalStatus, at: finalAt });
    }
  }

  return transitions;
}

export function getInitialStatusFromChangelog(
  changelog: ReadonlyArray<JiraChangelogEntry>,
  fallbackStatus: string
): string {
  const sorted = [...changelog].sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
  for (const history of sorted) {
    for (const item of history.items ?? []) {
      const previousStatus = item.field === 'status' ? (item.fromString ?? item.from) : null;
      if (previousStatus) {
        return previousStatus;
      }
    }
  }

  return fallbackStatus;
}

export function getCurrentColumnEnteredAt(
  transitions: ReadonlyArray<FlowTransition>,
  currentStatus: string,
  fallbackAt: string
): string {
  const match = [...transitions]
    .reverse()
    .find((transition) => transition.status === currentStatus);

  return match?.at ?? fallbackAt;
}

export function computeLeadTimeStats(values: number[]): {
  averageLeadTimeDays: number;
  medianLeadTimeDays: number;
} {
  if (values.length === 0) {
    return { averageLeadTimeDays: 0, medianLeadTimeDays: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const averageLeadTimeDays = Number((total / sorted.length).toFixed(2));
  const mid = Math.floor(sorted.length / 2);
  const medianLeadTimeDays = sorted.length % 2 === 1
    ? sorted[mid]
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));

  return { averageLeadTimeDays, medianLeadTimeDays };
}

export function classifyAgingZone(
  agingDays: number | null,
  agingP85: number,
  agingP95: number
): 'normal' | 'warning' | 'critical' {
  if (agingDays !== null && agingDays > agingP95) {
    return 'critical';
  }
  if (agingDays !== null && agingDays > agingP85) {
    return 'warning';
  }
  return 'normal';
}

export function buildTopAgingItems(wipItems: FlowItem[], agingP85: number, agingP95: number) {
  return wipItems
    .filter((item) => item.agingDays !== null)
    .sort((a, b) => (b.agingDays ?? 0) - (a.agingDays ?? 0))
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      key: item.key,
      summary: item.summary,
      issueType: item.issueType,
      status: item.currentColumn,
      agingDays: item.agingDays,
      zone: classifyAgingZone(item.agingDays, agingP85, agingP95)
    }));
}

