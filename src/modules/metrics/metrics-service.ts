import { env } from '../../config/env';
import type { JiraIssueSummary, JiraRuntimeConfig, JiraService } from '../jira/jira-service';
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
  extractBlockedPeriods,
  extractDiscoveredStatuses,
  getCurrentColumnEnteredAt,
  getDefaultCfdStatuses,
  getEffectiveRangeEndDate,
  getExclusiveEndDate,
  getFirstStatusTransitionAt,
  getInitialStatusFromChangelog,
  getPercentileValue,
   getUniqueSorted,
  groupResolvedByPeriod,
  isBlockedStatus,
  matchesIssueFilters,
  resolveFlowEfficiencyStatuses,
  shiftIsoDate,
  withBlockedMetrics,
  type FilterOptionsInput,
  type FlowBlockedPeriod,
  type FlowDashboardInput,
  type FlowItem,
  type LeadTimeInput,
  type LeadTimeStartMode,
  type ThroughputInput
} from './flow-domain';
import { mockResolvedIssues, type MockResolvedIssue } from './mock-throughput-data';

type LeadTimeIssueRecord = {
  key: string;
  summary: string;
  issueType: string;
  status: string;
  startAt: string;
  endAt: string;
  leadTimeDays: number;
  assignee?: string;
  squad?: string;
  priority?: string;
  labels?: string[];
};

type ResolvedLeadTimeSettings = {
  startMode: LeadTimeStartMode;
  startFieldId: string;
  startFieldName: string;
  boardId: number;
  startColumnName: string;
  endColumnName: string;
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
    const jiraConfig = this.jiraService.resolveConfig(input.jiraConfig);
    const issues = input.source === 'mock'
      ? this.getMockIssues(input)
      : await this.getResolvedIssuesFromJira(input, jiraConfig);

    return {
      generatedAt: new Date().toISOString(),
      projectKey: jiraConfig.projectKey,
      period: input.period,
      source: input.source ?? 'jira',
      startDate: input.startDate,
      endDate: input.endDate,
      filters: this.formatActiveFilters(input),
      totalResolved: issues.length,
      buckets: groupResolvedByPeriod(issues, input.period),
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
    const jiraConfig = this.jiraService.resolveConfig(input.jiraConfig);
    const settings = this.resolveLeadTimeSettings(input);
    const leadTimeIssues = input.source === 'mock'
      ? this.getMockLeadTimeIssues(input, settings.startMode)
      : await this.getLeadTimeIssuesFromJira(input, settings, jiraConfig);

    const { averageLeadTimeDays, medianLeadTimeDays } = computeLeadTimeStats(
      leadTimeIssues.map((issue) => issue.leadTimeDays)
    );

    return {
      generatedAt: new Date().toISOString(),
      projectKey: jiraConfig.projectKey,
      source: input.source ?? 'jira',
      startDate: input.startDate,
      endDate: input.endDate,
      leadTimeStart: {
        mode: settings.startMode,
        fieldId: settings.startMode === 'fieldDate' ? settings.startFieldId : null,
        fieldName: settings.startMode === 'fieldDate' ? settings.startFieldName : null,
        boardId: settings.startMode === 'boardColumn' ? settings.boardId : null,
        columnName: settings.startMode === 'boardColumn' ? settings.startColumnName : null
      },
      leadTimeEnd: {
        mode: 'boardColumn',
        boardId: settings.boardId,
        columnName: settings.endColumnName
      },
      filters: this.formatActiveFilters(input),
      issueCount: leadTimeIssues.length,
      averageLeadTimeDays,
      medianLeadTimeDays,
      issues: leadTimeIssues
    };
  }

  async getFlowDashboard(input: FlowDashboardInput) {
    const jiraConfig = this.jiraService.resolveConfig(input.jiraConfig);
    const startMode = input.startMode ?? env.LEAD_TIME_START_MODE;
    const source = input.source ?? 'jira';
    const throughputPeriod = input.throughputPeriod ?? 'week';
    const leadTimePeriod = input.leadTimePeriod ?? 'month';
    const endFlowColumn = input.endColumnName ?? env.LEAD_TIME_END_COLUMN_NAME;

    const flowItems = source === 'mock'
      ? this.getMockFlowItems(input, startMode)
      : await this.getJiraFlowItems(input, startMode, jiraConfig);
    const cfdStatuses = source === 'jira'
      ? await this.getBoardStatusOrder(input, jiraConfig, flowItems)
      : getDefaultCfdStatuses(flowItems);

    return this.assembleFlowDashboard({
      input,
      jiraProjectKey: jiraConfig.projectKey,
      source,
      throughputPeriod,
      leadTimePeriod,
      endFlowColumn,
      flowItems,
      cfdStatuses
    });
  }

  async getFilterOptions(input: FilterOptionsInput) {
    const jiraConfig = this.jiraService.resolveConfig(input.jiraConfig);
    const startMode = input.startMode ?? env.LEAD_TIME_START_MODE;
    const source = input.source ?? 'jira';
    const flowItems = source === 'mock'
      ? this.getMockFlowItems(input, startMode)
      : await this.getJiraFlowItems(input, startMode, jiraConfig);
    const discoveredStatuses = extractDiscoveredStatuses(flowItems);

    return {
      source,
      issueTypes: getUniqueSorted(flowItems.map((item) => item.issueType)),
      squads: getUniqueSorted(flowItems.map((item) => item.squad).filter((v): v is string => Boolean(v))),
      assignees: getUniqueSorted(flowItems.map((item) => item.assignee).filter((v): v is string => Boolean(v))),
      priorities: getUniqueSorted(flowItems.map((item) => item.priority).filter((v): v is string => Boolean(v))),
      leadTime: {
        startModes: ['boardColumn', 'created', 'fieldDate'],
        boardIds: getUniqueSorted(
          [String(input.boardId ?? ''), String(env.LEAD_TIME_BOARD_ID)].filter((v) => v.length > 0)
        ),
        startColumns: getUniqueSorted(
          [
            input.startColumnName ?? '',
            env.LEAD_TIME_START_COLUMN_NAME,
            ...discoveredStatuses.filter((status) => status.toLowerCase() !== 'done')
          ].filter((v) => v.length > 0)
        ),
        endColumns: getUniqueSorted(
          [input.endColumnName ?? '', env.LEAD_TIME_END_COLUMN_NAME, ...discoveredStatuses].filter(
            (v) => v.length > 0
          )
        ),
        startFieldIds: getUniqueSorted(
          [input.startFieldId ?? '', env.LEAD_TIME_START_FIELD_ID].filter((v) => v.length > 0)
        )
      }
    };
  }

  private resolveLeadTimeSettings(input: LeadTimeInput): ResolvedLeadTimeSettings {
    return {
      startMode: input.startMode ?? env.LEAD_TIME_START_MODE,
      startFieldId: input.startFieldId ?? env.LEAD_TIME_START_FIELD_ID,
      startFieldName: input.startFieldName ?? env.LEAD_TIME_START_FIELD_NAME,
      boardId: input.boardId ?? env.LEAD_TIME_BOARD_ID,
      startColumnName: input.startColumnName ?? env.LEAD_TIME_START_COLUMN_NAME,
      endColumnName: input.endColumnName ?? env.LEAD_TIME_END_COLUMN_NAME
    };
  }

  private formatActiveFilters(input: ThroughputInput | LeadTimeInput) {
    return {
      issueType: input.issueType ?? null,
      squad: input.squad ?? null,
      assignee: input.assignee ?? null,
      priority: input.priority ?? null
    };
  }

  private assembleFlowDashboard(params: {
    input: FlowDashboardInput;
    jiraProjectKey: string;
    source: 'jira' | 'mock';
    throughputPeriod: 'week' | 'month';
    leadTimePeriod: 'week' | 'month';
    endFlowColumn: string;
    flowItems: FlowItem[];
    cfdStatuses: string[];
  }) {
    const {
      input,
      jiraProjectKey,
      source,
      throughputPeriod,
      leadTimePeriod,
      endFlowColumn,
      flowItems,
      cfdStatuses
    } = params;
    const completedItems = flowItems.filter((item) => item.isDone && item.resolvedAt);
    const wipItems = flowItems.filter((item) => !item.isDone);
    const leadTimeValues = completedItems
      .map((item) => item.leadTimeDays)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    const agingValues = wipItems
      .map((item) => item.agingDays)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    const leadTimeP50 = getPercentileValue(leadTimeValues, 50);
    const leadTimeP85 = getPercentileValue(leadTimeValues, 85);
    const leadTimeP95 = getPercentileValue(leadTimeValues, 95);
    const { averageLeadTimeDays } = computeLeadTimeStats(leadTimeValues);
    const agingP85 = getPercentileValue(agingValues, 85);
    const agingP95 = getPercentileValue(agingValues, 95);

    const throughputByPeriod = groupResolvedByPeriod(completedItems, throughputPeriod);
    const stageBreakdown = flowItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.currentColumn] = (acc[item.currentColumn] ?? 0) + 1;
      return acc;
    }, {});
    const scatterplot = completedItems
      .filter((item) => item.resolvedAt && item.leadTimeDays !== null)
      .map((item) => ({
        key: item.key,
        resolvedAt: item.resolvedAt,
        leadTimeDays: item.leadTimeDays,
        issueType: item.issueType,
        squad: item.squad ?? null
      }));

    const effectiveEndDate = getEffectiveRangeEndDate(input.endDate);
    const flowEfficiencyStatuses = resolveFlowEfficiencyStatuses(
      input.flowActiveStatuses,
      input.flowInactiveStatuses,
      flowItems,
      endFlowColumn
    );
    const flowEfficiency = buildFlowEfficiency(
      flowItems,
      flowEfficiencyStatuses.activeStatuses,
      flowEfficiencyStatuses.inactiveStatuses,
      endFlowColumn
    );
    const flowEfficiencyTrend = buildFlowEfficiencyByPeriod(
      flowItems,
      input.startDate,
      effectiveEndDate,
      'month',
      flowEfficiencyStatuses.activeStatuses,
      flowEfficiencyStatuses.inactiveStatuses,
      endFlowColumn
    );
    const blockedSummary = buildBlockedSummary(wipItems);

    return {
      generatedAt: new Date().toISOString(),
      projectKey: jiraProjectKey,
      source,
      startDate: input.startDate,
      endDate: effectiveEndDate,
      summary: {
        completedCount: completedItems.length,
        wipCount: wipItems.length,
        totalCount: flowItems.length,
        averageLeadTimeDays,
        leadTimeP50,
        leadTimeP85,
        leadTimeP95,
        flowEfficiencyPercent: flowEfficiency.efficiencyPercent,
        activeTimeAverageDays: flowEfficiency.activeTimeAverageDays,
        waitTimeAverageDays: flowEfficiency.waitTimeAverageDays,
        blockedItemsPercent: blockedSummary.blockedItemsPercent,
        blockedItemsCount: blockedSummary.blockedItemsCount,
        averageBlockedDays: blockedSummary.averageBlockedDays,
        agingP85,
        agingP95
      },
      filters: this.formatActiveFilters(input),
      insights: buildDashboardInsights({
        completedCount: completedItems.length,
        wipCount: wipItems.length,
        totalCount: flowItems.length,
        leadTimeP50,
        leadTimeP85,
        leadTimeP95,
        agingP85,
        agingP95,
        weeklyThroughput: Object.values(throughputByPeriod)
      }),
      charts: {
        leadTimeScatterplot: {
          percentiles: { p50: leadTimeP50, p85: leadTimeP85, p95: leadTimeP95 },
          items: scatterplot
        },
        leadTimeTrend: buildLeadTimeAverageByPeriod(completedItems, leadTimePeriod),
        throughputRunChart: {
          period: throughputPeriod,
          buckets: throughputByPeriod
        },
        blockedRateChart: {
          period: throughputPeriod,
          buckets: buildBlockedRateByPeriod(flowItems, input.startDate, effectiveEndDate, throughputPeriod)
        },
        blockedTimeChart: {
          period: throughputPeriod,
          buckets: buildBlockedTimeByPeriod(flowItems, input.startDate, effectiveEndDate, throughputPeriod)
        },
        flowEfficiencyTrend: {
          period: 'month',
          buckets: flowEfficiencyTrend
        },
        stageTimeAverage: buildStageTimeAverage(flowItems, endFlowColumn),
        agingChart: {
          percentiles: { p85: agingP85, p95: agingP95 },
          items: buildTopAgingItems(wipItems, agingP85, agingP95)
        },
        cycleTimeHistogram: buildHistogram(leadTimeValues),
        stageBreakdown,
        cumulativeFlow: {
          statuses: cfdStatuses,
          series: buildCfdSeries(flowItems, input.startDate, effectiveEndDate, cfdStatuses)
        }
      }
    };
  }

  private async getResolvedIssuesFromJira(
    input: ThroughputInput | LeadTimeInput,
    jiraConfig: JiraRuntimeConfig
  ) {
    const jql = buildJiraSearchJql({
      projectKey: jiraConfig.projectKey ?? env.JIRA_PROJECT_KEY,
      startDate: input.startDate,
      endDate: input.endDate,
      issueType: input.issueType,
      assignee: input.assignee
    });
    const extraFields =
      'startMode' in input && (input.startMode ?? env.LEAD_TIME_START_MODE) === 'fieldDate'
        ? [input.startFieldId ?? env.LEAD_TIME_START_FIELD_ID]
        : [];

    return this.jiraService.searchIssues(jql, 200, extraFields, jiraConfig);
  }

  private getMockIssues(input: ThroughputInput | LeadTimeInput): MockResolvedIssue[] {
    const start = new Date(`${input.startDate}T00:00:00.000Z`);
    const end = new Date(`${getExclusiveEndDate(input.endDate)}T00:00:00.000Z`);

    return mockResolvedIssues.filter((issue) => {
      if (!issue.resolvedAt) {
        return false;
      }
      const resolvedAt = new Date(issue.resolvedAt);
      return resolvedAt >= start && resolvedAt < end && matchesIssueFilters(issue, input);
    });
  }

  private getMockLeadTimeIssues(
    input: LeadTimeInput,
    startMode: LeadTimeStartMode
  ): LeadTimeIssueRecord[] {
    return this.getMockIssues(input)
      .map((issue) => {
        const startAt = this.getMockLeadTimeStart(issue.key, issue.resolvedAt, startMode);
        const endAt = issue.resolvedAt || null;

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
          leadTimeDays: diffInDays(startAt, endAt),
          assignee: issue.assignee,
          squad: issue.squad,
          priority: issue.priority,
          labels: issue.labels
        };
      })
      .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }

  private getMockFlowItems(input: FlowDashboardInput, startMode: LeadTimeStartMode): FlowItem[] {
    const doneItems = this.getMockIssues(input).map((issue) =>
      this.buildMockDoneFlowItem(issue, startMode)
    );
    const wipItems = this.getMockActiveFlowItems().filter((item) => matchesIssueFilters(item, input));

    return [...doneItems, ...wipItems].map((item) => withBlockedMetrics(item));
  }

  private buildMockDoneFlowItem(issue: MockResolvedIssue, startMode: LeadTimeStartMode): FlowItem {
    const resolvedAt = issue.resolvedAt;
    const startAt = this.getMockLeadTimeStart(issue.key, resolvedAt, startMode) ?? resolvedAt;
    const transitions = this.buildMockDoneTransitions(startAt, resolvedAt);

    return {
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: 'Done',
      assignee: issue.assignee,
      squad: issue.squad,
      priority: issue.priority,
      labels: issue.labels,
      createdAt: shiftIsoDate(startAt, -(2 + (this.getIssueSeed(issue.key) % 4))),
      resolvedAt,
      startAt,
      currentColumn: 'Done',
      currentColumnEnteredAt: resolvedAt,
      transitions,
      blockedPeriods: this.buildMockBlockedPeriods(startAt, resolvedAt, issue.key),
      blockedDays: 0,
      isBlocked: false,
      leadTimeDays: diffInDays(startAt, resolvedAt),
      cycleTimeDays: diffInDays(transitions[1]?.at ?? startAt, resolvedAt),
      agingDays: null,
      isDone: true
    };
  }

  private async getJiraFlowItems(
    input: FlowDashboardInput,
    _startMode: LeadTimeStartMode,
    jiraConfig: JiraRuntimeConfig
  ): Promise<FlowItem[]> {
    const doneIssues = await this.getLeadTime({ ...input, jiraConfig });
    const recentIssues = await this.jiraService.getRecentIssues(undefined, 20, jiraConfig);
    const endFlowColumn = input.endColumnName ?? env.LEAD_TIME_END_COLUMN_NAME;
    const startFlowColumn = input.startColumnName ?? env.LEAD_TIME_START_COLUMN_NAME;

    const doneItems = await Promise.all(
      doneIssues.issues.map((issue) =>
        this.buildJiraDoneFlowItem(issue, startFlowColumn, endFlowColumn, jiraConfig)
      )
    );
    const pendingItems = await Promise.all(
      recentIssues
        .filter((issue) => !issue.resolvedAt)
        .map((issue) => this.buildJiraWipFlowItem(issue, jiraConfig))
    );

    return [...doneItems, ...pendingItems];
  }

  private async buildJiraDoneFlowItem(
    issue: LeadTimeIssueRecord,
    startFlowColumn: string,
    endFlowColumn: string,
    jiraConfig: JiraRuntimeConfig
  ): Promise<FlowItem> {
    const changelog = await this.jiraService.getIssueChangelog(issue.key, jiraConfig);
    const transitions = buildJiraStatusTransitions(
      changelog,
      startFlowColumn,
      issue.startAt,
      endFlowColumn,
      issue.endAt
    );
    const blockedPeriods = extractBlockedPeriods(changelog, issue.endAt, endFlowColumn, issue.endAt);

    return withBlockedMetrics({
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      createdAt: issue.startAt,
      resolvedAt: issue.endAt,
      startAt: issue.startAt,
      currentColumn: endFlowColumn,
      currentColumnEnteredAt: getCurrentColumnEnteredAt(transitions, endFlowColumn, issue.endAt),
      transitions,
      blockedPeriods,
      blockedDays: 0,
      isBlocked: false,
      leadTimeDays: issue.leadTimeDays,
      cycleTimeDays: issue.leadTimeDays,
      agingDays: null,
      isDone: true
    });
  }

  private async buildJiraWipFlowItem(
    issue: JiraIssueSummary,
    jiraConfig: JiraRuntimeConfig
  ): Promise<FlowItem> {
    const changelog = await this.jiraService.getIssueChangelog(issue.key, jiraConfig);
    const initialStatus = getInitialStatusFromChangelog(changelog, issue.status);
    const transitions = buildJiraStatusTransitions(changelog, initialStatus, issue.createdAt);
    const enteredAt = getCurrentColumnEnteredAt(transitions, issue.status, issue.createdAt);
    const blockedPeriods = extractBlockedPeriods(changelog, undefined, issue.status, enteredAt);

    return withBlockedMetrics({
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      createdAt: issue.createdAt,
      resolvedAt: null,
      startAt: issue.createdAt,
      currentColumn: issue.status,
      currentColumnEnteredAt: enteredAt,
      transitions,
      blockedPeriods,
      blockedDays: 0,
      isBlocked: false,
      leadTimeDays: null,
      cycleTimeDays: null,
      agingDays: diffInDays(issue.createdAt, new Date().toISOString()),
      isDone: false
    });
  }

  private buildMockDoneTransitions(startAt: string, endAt: string) {
    const totalDays = Math.max(3, diffInDays(startAt, endAt));
    const devAt = shiftIsoDate(startAt, 1);
    const readyForTestAt = shiftIsoDate(startAt, Math.max(2, Math.round(totalDays * 0.45)));
    const inTestAt = shiftIsoDate(startAt, Math.max(3, Math.round(totalDays * 0.68)));
    const deployAt = shiftIsoDate(startAt, Math.max(4, Math.round(totalDays * 0.88)));

    return [
      { status: 'Pronto para Desenvolvimento', at: startAt },
      { status: 'Em Desenvolvimento', at: devAt },
      { status: 'Pronto para Testes', at: readyForTestAt },
      { status: 'Em Testes', at: inTestAt },
      { status: 'Em Deploy para Produção', at: deployAt },
      { status: 'Done', at: endAt }
    ];
  }

  private getMockActiveFlowItems(): FlowItem[] {
    const now = new Date('2026-07-12T12:00:00.000Z').toISOString();
    const specs = [
      ['KAN-201', 'Consolidar relatorio executivo de julho', 'Story', 'High', 'Core', 'Joao', 'Em Desenvolvimento', 9, ['analytics', 'executive']],
      ['KAN-202', 'Ajustar importacao de CSV do Jira', 'Task', 'Medium', 'Platform', 'Ana', 'Pronto para Desenvolvimento', 5, ['import', 'csv']],
      ['KAN-203', 'Investigar erro intermitente no parser', 'Bug', 'High', 'Core', 'Carlos', 'Em Testes', 8, ['parser', 'bug']],
      ['KAN-204', 'Criar visao de aging por squad', 'Story', 'Medium', 'Growth', 'Marina', 'Pronto para Testes', 6, ['aging', 'dashboard']],
      ['KAN-205', 'Preparar filtros por prioridade', 'Task', 'Low', 'Growth', 'Marina', 'Em Desenvolvimento', 12, ['filters']],
      ['KAN-206', 'Automatizar carga de planilhas', 'Spike', 'Medium', 'Platform', 'Ana', 'Em Deploy para Produção', 5, ['excel', 'automation']],
      ['KAN-207', 'Refinar legenda dos percentis', 'Task', 'Low', 'Core', 'Joao', 'Pronto para Desenvolvimento', 8, ['ux']],
      ['KAN-208', 'Validar dashboard com operacoes', 'Story', 'High', 'Growth', 'Carlos', 'Em Testes', 10, ['ops', 'validation']],
      ['KAN-209', 'Padronizar colunas de exportacao', 'Task', 'Medium', 'Platform', 'Ana', 'Em Desenvolvimento', 15, ['export']],
      ['KAN-210', 'Montar amostra para treinamento interno', 'Story', 'Low', 'Core', 'Marina', 'Pronto para Testes', 11, ['training']]
    ] as const;

    return specs.map(([key, summary, issueType, priority, squad, assignee, currentColumn, agingDays, labels]) => {
      const currentEnteredAt = shiftIsoDate(now, -agingDays);
      const startAt = shiftIsoDate(currentEnteredAt, -(1 + (this.getIssueSeed(key) % 3)));
      const createdAt = shiftIsoDate(startAt, -(2 + (this.getIssueSeed(key) % 4)));

      return {
        key,
        summary,
        issueType,
        status: currentColumn,
        assignee,
        squad,
        priority,
        labels: [...labels],
        createdAt,
        resolvedAt: null,
        startAt,
        currentColumn,
        currentColumnEnteredAt: currentEnteredAt,
        transitions: this.buildMockWipTransitions(startAt, currentColumn, currentEnteredAt),
        blockedPeriods: this.buildMockBlockedPeriods(startAt, now, key, currentColumn, currentEnteredAt),
        blockedDays: 0,
        isBlocked: false,
        leadTimeDays: diffInDays(startAt, now),
        cycleTimeDays: diffInDays(startAt, now),
        agingDays,
        isDone: false
      } satisfies FlowItem;
    });
  }

  private buildMockWipTransitions(startAt: string, currentColumn: string, currentEnteredAt: string) {
    const devAt = shiftIsoDate(startAt, 1);
    const readyForTestAt = shiftIsoDate(devAt, 2);
    const inTestAt = shiftIsoDate(readyForTestAt, 1);
    const orderedStages = [
      { status: 'Pronto para Desenvolvimento', at: startAt },
      { status: 'Em Desenvolvimento', at: devAt },
      { status: 'Pronto para Testes', at: readyForTestAt },
      { status: 'Em Testes', at: inTestAt },
      { status: 'Em Deploy para Produção', at: currentEnteredAt }
    ];

    const targetIndex = orderedStages.findIndex((stage) => stage.status === currentColumn);
    const effectiveIndex = targetIndex === -1 ? orderedStages.length - 1 : targetIndex;
    const transitions = orderedStages.slice(0, effectiveIndex + 1).map((stage) => ({ ...stage }));
    if (effectiveIndex > 0) {
      transitions[effectiveIndex].at = currentEnteredAt;
    }

    return transitions;
  }

  private getLeadTimeStartFromJiraIssue(
    issue: JiraIssueSummary,
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
    const daysBack = startMode === 'created' ? 8 + (seed % 9) : 3 + (seed % 6);

    resolvedDate.setUTCDate(resolvedDate.getUTCDate() - daysBack);
    return resolvedDate.toISOString();
  }

  private async getLeadTimeIssuesFromJira(
    input: LeadTimeInput,
    settings: ResolvedLeadTimeSettings,
    jiraConfig: JiraRuntimeConfig
  ): Promise<LeadTimeIssueRecord[]> {
    const issues = await this.getResolvedIssuesFromJira(input, jiraConfig);

    if (settings.startMode !== 'boardColumn') {
      return this.mapFieldOrCreatedLeadTimeIssues(issues, settings.startMode, settings.startFieldId);
    }

    return this.mapBoardColumnLeadTimeIssues(issues, input, settings, jiraConfig);
  }

  private mapFieldOrCreatedLeadTimeIssues(
    issues: JiraIssueSummary[],
    startMode: LeadTimeStartMode,
    startFieldId: string
  ): LeadTimeIssueRecord[] {
    return issues
      .map((issue) => {
        const startAt = this.getLeadTimeStartFromJiraIssue(issue, startMode, startFieldId);
        if (!issue.resolvedAt || !startAt) {
          return null;
        }

        return this.toLeadTimeIssueRecord(issue, startAt, issue.resolvedAt);
      })
      .filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }

  private async mapBoardColumnLeadTimeIssues(
    issues: JiraIssueSummary[],
    input: LeadTimeInput,
    settings: ResolvedLeadTimeSettings,
    jiraConfig: JiraRuntimeConfig
  ): Promise<LeadTimeIssueRecord[]> {
    const [startStatuses, endStatuses] = await Promise.all([
      this.jiraService.getBoardColumnStatuses(settings.boardId, settings.startColumnName, jiraConfig),
      this.jiraService.getBoardColumnStatuses(settings.boardId, settings.endColumnName, jiraConfig)
    ]);
    const rangeStart = new Date(`${input.startDate}T00:00:00.000Z`);
    const rangeEnd = new Date(`${getExclusiveEndDate(input.endDate)}T00:00:00.000Z`);

    const leadTimeIssues = await Promise.all(
      issues.map(async (issue) => {
        const changelog = await this.jiraService.getIssueChangelog(issue.key, jiraConfig);
        const startAt = getFirstStatusTransitionAt(changelog, startStatuses);
        const endAt = getFirstStatusTransitionAt(changelog, endStatuses) ?? issue.resolvedAt;

        if (!startAt || !endAt) {
          return null;
        }

        const endDate = new Date(endAt);
        if (!(endDate >= rangeStart && endDate < rangeEnd)) {
          return null;
        }

        return this.toLeadTimeIssueRecord(issue, startAt, endAt);
      })
    );

    return leadTimeIssues.filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }

  private toLeadTimeIssueRecord(
    issue: JiraIssueSummary,
    startAt: string,
    endAt: string
  ): LeadTimeIssueRecord {
    return {
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      startAt,
      endAt,
      leadTimeDays: diffInDays(startAt, endAt),
      assignee: undefined,
      squad: undefined,
      priority: undefined,
      labels: undefined
    };
  }

  private getIssueSeed(key: string) {
    return key.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  }

  private async getBoardStatusOrder(
    input: FlowDashboardInput,
    jiraConfig: JiraRuntimeConfig,
    flowItems: FlowItem[]
  ) {
    const boardId = input.boardId ?? env.LEAD_TIME_BOARD_ID;

    if (!boardId) {
      return getDefaultCfdStatuses(flowItems);
    }

    try {
      const boardColumns = await this.jiraService.getBoardColumns(boardId, jiraConfig);
      const discoveredStatuses = getUniqueSorted(flowItems.map((item) => item.currentColumn));
      const normalizedColumns = boardColumns.filter((column) => column.length > 0 && column !== 'Done');
      const extras = discoveredStatuses.filter(
        (status) => !normalizedColumns.includes(status) && status !== 'Done'
      );
      const hasDone = discoveredStatuses.includes('Done');

      return [
        ...(hasDone ? ['Done'] : []),
        ...normalizedColumns.reverse(),
        ...extras.reverse()
      ];
    } catch {
      return getDefaultCfdStatuses(flowItems);
    }
  }

  private buildMockBlockedPeriods(
    startAt: string,
    endAt: string,
    issueKey: string,
    currentColumn?: string,
    currentColumnEnteredAt?: string
  ): FlowBlockedPeriod[] {
    const seed = this.getIssueSeed(issueKey);
    const canBeBlocked = seed % 3 === 0 || seed % 5 === 0;

    if (!canBeBlocked) {
      return [];
    }

    if (currentColumn && isBlockedStatus(currentColumn)) {
      return [{ startAt: currentColumnEnteredAt ?? startAt }].filter((p) => p.startAt.length > 0);
    }

    const blockedStart = shiftIsoDate(startAt, 1 + (seed % 2));
    const blockedEnd = shiftIsoDate(blockedStart, 1 + (seed % 3));

    if (!endAt || new Date(blockedEnd).getTime() >= new Date(endAt).getTime()) {
      return [];
    }

    return [{ startAt: blockedStart, endAt: blockedEnd }];
  }
}
