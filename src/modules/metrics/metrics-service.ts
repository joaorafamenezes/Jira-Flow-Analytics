import { env } from '../../config/env';
import type { JiraRuntimeConfig, JiraService } from '../jira/jira-service';
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
  jiraConfig?: JiraRuntimeConfig;
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
  jiraConfig?: JiraRuntimeConfig;
};

type FlowDashboardInput = LeadTimeInput & {
  throughputPeriod?: Extract<ThroughputPeriod, 'week' | 'month'>;
  leadTimePeriod?: Extract<ThroughputPeriod, 'week' | 'month'>;
  flowActiveStatuses?: string;
  flowInactiveStatuses?: string;
};
type FilterOptionsInput = {
  startDate: string;
  endDate: string;
  source?: ThroughputSource;
  startMode?: LeadTimeStartMode;
  boardId?: number;
  startColumnName?: string;
  endColumnName?: string;
  startFieldId?: string;
  jiraConfig?: JiraRuntimeConfig;
};

type FlowItem = {
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
  transitions: Array<{
    status: string;
    at: string;
  }>;
  leadTimeDays: number | null;
  cycleTimeDays: number | null;
  agingDays: number | null;
  isDone: boolean;
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
    const jiraConfig = this.getJiraConfig(input.jiraConfig);
    const issues = input.source === 'mock'
      ? this.getMockIssues(input)
      : await this.getResolvedIssuesFromJira(input, jiraConfig);

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
      projectKey: jiraConfig.projectKey,
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
    const jiraConfig = this.getJiraConfig(input.jiraConfig);
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
      projectKey: jiraConfig.projectKey,
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

  async getFlowDashboard(input: FlowDashboardInput) {
    const jiraConfig = this.getJiraConfig(input.jiraConfig);
    const startMode = input.startMode ?? env.LEAD_TIME_START_MODE;
    const source = input.source ?? 'jira';
    const throughputPeriod = input.throughputPeriod ?? 'week';
    const leadTimePeriod = input.leadTimePeriod ?? 'month';
    const activeStatuses = this.parseStatuses(input.flowActiveStatuses, ['Em Desenvolvimento', 'Em Testes', 'Em Deploy para Produção']);
    const inactiveStatuses = this.parseStatuses(input.flowInactiveStatuses, ['Pronto para Desenvolvimento', 'Pronto para Testes']);
    const flowItems = source === 'mock'
      ? this.getMockFlowItems(input, startMode)
      : await this.getJiraFlowItems(input, startMode, jiraConfig);

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

    const leadTimeP50 = this.getPercentileValue(leadTimeValues, 50);
    const leadTimeP85 = this.getPercentileValue(leadTimeValues, 85);
    const leadTimeP95 = this.getPercentileValue(leadTimeValues, 95);
    const agingP85 = this.getPercentileValue(agingValues, 85);
    const agingP95 = this.getPercentileValue(agingValues, 95);

    const throughputByPeriod = completedItems.reduce<Record<string, number>>((acc, item) => {
      if (!item.resolvedAt) {
        return acc;
      }

      const bucket = this.getBucket(item.resolvedAt, throughputPeriod);
      acc[bucket] = (acc[bucket] ?? 0) + 1;
      return acc;
    }, {});

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

    const histogram = this.buildHistogram(leadTimeValues);
    const leadTimeTrend = this.buildLeadTimeAverageByPeriod(completedItems, leadTimePeriod);
    const stageTimeAverage = this.buildStageTimeAverage(flowItems);
    const flowEfficiency = this.buildFlowEfficiency(completedItems, activeStatuses, inactiveStatuses);
    const cfd = this.buildCfdSeries(flowItems, input.startDate, input.endDate);
    const topAgingItems = wipItems
      .filter((item) => item.agingDays !== null)
      .sort((a, b) => (b.agingDays ?? 0) - (a.agingDays ?? 0))
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        key: item.key,
        status: item.currentColumn,
        agingDays: item.agingDays,
        zone: item.agingDays !== null && item.agingDays > agingP95
          ? 'critical'
          : item.agingDays !== null && item.agingDays > agingP85
            ? 'warning'
            : 'normal'
      }));

    const insights = this.buildDashboardInsights({
      completedCount: completedItems.length,
      wipCount: wipItems.length,
      totalCount: flowItems.length,
      leadTimeP50,
      leadTimeP85,
      leadTimeP95,
      agingP85,
      agingP95,
      weeklyThroughput: Object.values(throughputByPeriod)
    });

    return {
      generatedAt: new Date().toISOString(),
      projectKey: jiraConfig.projectKey,
      source,
      startDate: input.startDate,
      endDate: input.endDate,
      summary: {
        completedCount: completedItems.length,
        wipCount: wipItems.length,
        totalCount: flowItems.length,
        leadTimeP50,
        leadTimeP85,
        leadTimeP95,
        flowEfficiencyPercent: flowEfficiency.efficiencyPercent,
        activeTimeAverageDays: flowEfficiency.activeTimeAverageDays,
        waitTimeAverageDays: flowEfficiency.waitTimeAverageDays,
        agingP85,
        agingP95
      },
      filters: {
        issueType: input.issueType ?? null,
        squad: input.squad ?? null,
        assignee: input.assignee ?? null,
        priority: input.priority ?? null
      },
      insights,
      charts: {
        leadTimeScatterplot: {
          percentiles: {
            p50: leadTimeP50,
            p85: leadTimeP85,
            p95: leadTimeP95
          },
          items: scatterplot
        },
        leadTimeTrend,
        throughputRunChart: {
          period: throughputPeriod,
          buckets: throughputByPeriod
        },
        stageTimeAverage,
        agingChart: {
          percentiles: {
            p85: agingP85,
            p95: agingP95
          },
          items: topAgingItems
        },
        cycleTimeHistogram: histogram,
        stageBreakdown,
        cumulativeFlow: cfd
      }
    };
  }

  async getFilterOptions(input: FilterOptionsInput) {
    const jiraConfig = this.getJiraConfig(input.jiraConfig);
    const startMode = input.startMode ?? env.LEAD_TIME_START_MODE;
    const source = input.source ?? 'jira';
    const flowItems = source === 'mock'
      ? this.getMockFlowItems(input, startMode)
      : await this.getJiraFlowItems(input as FlowDashboardInput, startMode, jiraConfig);
    const discoveredStatuses = this.getUniqueSorted([
      ...flowItems.map((item) => item.currentColumn),
      ...flowItems.flatMap((item) => item.transitions.map((transition) => transition.status))
    ]);

    return {
      source,
      issueTypes: this.getUniqueSorted(flowItems.map((item) => item.issueType)),
      squads: this.getUniqueSorted(flowItems.map((item) => item.squad).filter((value): value is string => Boolean(value))),
      assignees: this.getUniqueSorted(flowItems.map((item) => item.assignee).filter((value): value is string => Boolean(value))),
      priorities: this.getUniqueSorted(flowItems.map((item) => item.priority).filter((value): value is string => Boolean(value))),
      leadTime: {
        startModes: ['boardColumn', 'created', 'fieldDate'],
        boardIds: this.getUniqueSorted([
          String(input.boardId ?? ''),
          String(env.LEAD_TIME_BOARD_ID)
        ].filter((value) => value.length > 0)),
        startColumns: this.getUniqueSorted([
          input.startColumnName ?? '',
          env.LEAD_TIME_START_COLUMN_NAME,
          ...discoveredStatuses.filter((status) => status.toLowerCase() !== 'done')
        ].filter((value) => value.length > 0)),
        endColumns: this.getUniqueSorted([
          input.endColumnName ?? '',
          env.LEAD_TIME_END_COLUMN_NAME,
          ...discoveredStatuses
        ].filter((value) => value.length > 0)),
        startFieldIds: this.getUniqueSorted([
          input.startFieldId ?? '',
          env.LEAD_TIME_START_FIELD_ID
        ].filter((value) => value.length > 0))
      }
    };
  }

  private async getResolvedIssuesFromJira(
    input: ThroughputInput | LeadTimeInput,
    jiraConfig: JiraRuntimeConfig
  ) {
    const filters = [
      `project = ${jiraConfig.projectKey}`,
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

    return this.jiraService.searchIssues(jql, 200, extraFields, jiraConfig);
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

  private getMockFlowItems(input: FlowDashboardInput, startMode: LeadTimeStartMode) {
    const doneItems = this.getMockIssues(input).map((issue) => {
      const resolvedAt = issue.resolvedAt;
      const startAt = this.getMockLeadTimeStart(issue.key, resolvedAt ?? '', startMode) ?? issue.resolvedAt ?? '';
      const transitions = this.buildMockDoneTransitions(startAt, resolvedAt ?? '');

      return {
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        status: 'Done',
        assignee: issue.assignee,
        squad: issue.squad,
        priority: issue.priority,
        labels: issue.labels,
        createdAt: this.shiftIsoDate(startAt, -(2 + (this.getIssueSeed(issue.key) % 4))),
        resolvedAt,
        startAt,
        currentColumn: 'Done',
        currentColumnEnteredAt: resolvedAt ?? startAt,
        transitions,
        leadTimeDays: resolvedAt ? this.diffInDays(startAt, resolvedAt) : null,
        cycleTimeDays: resolvedAt ? this.diffInDays(transitions[1]?.at ?? startAt, resolvedAt) : null,
        agingDays: null,
        isDone: true
      } satisfies FlowItem;
    });

    const wipItems = this.getMockActiveFlowItems().filter((item) => {
      if (input.issueType && item.issueType !== input.issueType) {
        return false;
      }

      if (input.squad && item.squad !== input.squad) {
        return false;
      }

      if (input.assignee && item.assignee !== input.assignee) {
        return false;
      }

      if (input.priority && item.priority !== input.priority) {
        return false;
      }

      return true;
    });

    return [...doneItems, ...wipItems];
  }

  private async getJiraFlowItems(
    input: FlowDashboardInput,
    startMode: LeadTimeStartMode,
    jiraConfig: JiraRuntimeConfig
  ) {
    const doneIssues = await this.getLeadTime({ ...input, jiraConfig });
    const recentIssues = await this.jiraService.getRecentIssues(undefined, 20, jiraConfig);
    const doneItems: FlowItem[] = doneIssues.issues.map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      createdAt: issue.startAt,
      resolvedAt: issue.endAt,
      startAt: issue.startAt,
      currentColumn: 'Done',
      currentColumnEnteredAt: issue.endAt,
      transitions: [
        { status: startMode === 'boardColumn' ? (input.startColumnName ?? env.LEAD_TIME_START_COLUMN_NAME) : 'Start', at: issue.startAt },
        { status: 'Done', at: issue.endAt }
      ],
      leadTimeDays: issue.leadTimeDays,
      cycleTimeDays: issue.leadTimeDays,
      agingDays: null,
      isDone: true
    }));

    const pendingItems: FlowItem[] = recentIssues
      .filter((issue) => !issue.resolvedAt)
      .map((issue) => ({
        key: issue.key,
        summary: issue.summary,
        issueType: issue.issueType,
        status: issue.status,
        createdAt: issue.createdAt,
        resolvedAt: null,
        startAt: issue.createdAt,
        currentColumn: issue.status,
        currentColumnEnteredAt: issue.createdAt,
        transitions: [{ status: issue.status, at: issue.createdAt }],
        leadTimeDays: null,
        cycleTimeDays: null,
        agingDays: this.diffInDays(issue.createdAt, new Date().toISOString()),
        isDone: false
      }));

    return [...doneItems, ...pendingItems];
  }

  private getJiraConfig(config?: JiraRuntimeConfig) {
    return {
      host: config?.host ?? env.JIRA_HOST,
      email: config?.email ?? env.JIRA_EMAIL,
      apiToken: config?.apiToken ?? env.JIRA_API_TOKEN,
      projectKey: config?.projectKey ?? env.JIRA_PROJECT_KEY,
      defaultJql: config?.defaultJql ?? env.JIRA_DEFAULT_JQL
    };
  }

  private buildMockDoneTransitions(startAt: string, endAt: string) {
    const totalDays = Math.max(3, this.diffInDays(startAt, endAt));
    const devAt = this.shiftIsoDate(startAt, 1);
    const readyForTestAt = this.shiftIsoDate(startAt, Math.max(2, Math.round(totalDays * 0.45)));
    const inTestAt = this.shiftIsoDate(startAt, Math.max(3, Math.round(totalDays * 0.68)));
    const deployAt = this.shiftIsoDate(startAt, Math.max(4, Math.round(totalDays * 0.88)));

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
      const currentEnteredAt = this.shiftIsoDate(now, -agingDays);
      const startAt = this.shiftIsoDate(currentEnteredAt, -(1 + (this.getIssueSeed(key) % 3)));
      const createdAt = this.shiftIsoDate(startAt, -(2 + (this.getIssueSeed(key) % 4)));

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
        leadTimeDays: this.diffInDays(startAt, now),
        cycleTimeDays: this.diffInDays(startAt, now),
        agingDays,
        isDone: false
      } satisfies FlowItem;
    });
  }

  private buildMockWipTransitions(startAt: string, currentColumn: string, currentEnteredAt: string) {
    const transitions = [{ status: 'Pronto para Desenvolvimento', at: startAt }];

    if (currentColumn === 'Pronto para Desenvolvimento') {
      return transitions;
    }

    const devAt = this.shiftIsoDate(startAt, 1);
    transitions.push({ status: 'Em Desenvolvimento', at: devAt });

    if (currentColumn === 'Em Desenvolvimento') {
      transitions[1].at = currentEnteredAt;
      return transitions;
    }

    const readyForTestAt = this.shiftIsoDate(devAt, 2);
    transitions.push({ status: 'Pronto para Testes', at: readyForTestAt });

    if (currentColumn === 'Pronto para Testes') {
      transitions[2].at = currentEnteredAt;
      return transitions;
    }

    const inTestAt = this.shiftIsoDate(readyForTestAt, 1);
    transitions.push({ status: 'Em Testes', at: inTestAt });

    if (currentColumn === 'Em Testes') {
      transitions[3].at = currentEnteredAt;
      return transitions;
    }

    transitions.push({ status: 'Em Deploy para Produção', at: currentEnteredAt });
    return transitions;
  }

  private buildHistogram(values: number[]) {
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

  private buildLeadTimeAverageByPeriod(flowItems: FlowItem[], period: 'week' | 'month') {
    const buckets = flowItems
      .filter((item) => item.isDone && item.resolvedAt && item.leadTimeDays !== null)
      .reduce<Record<string, { totalDays: number; count: number; averageDays: number }>>((acc, item) => {
        const bucket = this.getBucket(item.resolvedAt!, period);
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

  private buildStageTimeAverage(flowItems: FlowItem[]) {
    const stageAccumulator = flowItems.reduce<Record<string, { totalDays: number; count: number }>>((acc, item) => {
      const transitions = [...item.transitions].sort((a, b) => a.at.localeCompare(b.at));

      transitions.forEach((transition, index) => {
        const nextTransition = transitions[index + 1];
        const endAt = nextTransition?.at
          ?? (item.isDone ? item.resolvedAt : item.currentColumnEnteredAt);

        if (!endAt || transition.status === 'Done') {
          return;
        }

        const duration = this.diffInDays(transition.at, endAt);
        if (duration < 0) {
          return;
        }

        const current = acc[transition.status] ?? { totalDays: 0, count: 0 };
        current.totalDays += duration;
        current.count += 1;
        acc[transition.status] = current;
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

  private buildFlowEfficiency(flowItems: FlowItem[], activeStatuses: string[], inactiveStatuses: string[]) {
    const active = new Set(activeStatuses.map((status) => status.toLowerCase()));
    const inactive = new Set(inactiveStatuses.map((status) => status.toLowerCase()));
    let totalActiveDays = 0;
    let totalWaitDays = 0;
    let countedItems = 0;

    flowItems.forEach((item) => {
      const transitions = [...item.transitions].sort((a, b) => a.at.localeCompare(b.at));
      let itemActiveDays = 0;
      let itemWaitDays = 0;

      transitions.forEach((transition, index) => {
        const nextTransition = transitions[index + 1];
        const endAt = nextTransition?.at ?? item.resolvedAt;

        if (!endAt || transition.status === 'Done') {
          return;
        }

        const duration = this.diffInDays(transition.at, endAt);
        if (duration < 0) {
          return;
        }

        const normalizedStatus = transition.status.toLowerCase();
        if (active.has(normalizedStatus)) {
          itemActiveDays += duration;
        } else if (inactive.has(normalizedStatus)) {
          itemWaitDays += duration;
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

  private parseStatuses(value: string | undefined, defaults: string[]) {
    const parsed = (value ?? '')
      .split(/\r?\n|,|;/)
      .map((status) => status.trim())
      .filter((status) => status.length > 0);

    return parsed.length > 0 ? parsed : defaults;
  }

  private buildCfdSeries(flowItems: FlowItem[], startDate: string, endDate: string) {
    const weeks = this.getWeekSeries(startDate, endDate);
    const statuses = [
      'Done',
      'Em Deploy para Produção',
      'Em Testes',
      'Pronto para Testes',
      'Em Desenvolvimento',
      'Pronto para Desenvolvimento'
    ];

    return weeks.map((week) => {
      const snapshotAt = `${week}T23:59:59.000Z`;
      const counts = statuses.reduce<Record<string, number>>((acc, status) => {
        acc[status] = 0;
        return acc;
      }, {});

      flowItems.forEach((item) => {
        const statusAtDate = this.getFlowItemStatusAtDate(item, snapshotAt);
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

  private getFlowItemStatusAtDate(item: FlowItem, snapshotAt: string) {
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

  private getWeekSeries(startDate: string, endDate: string) {
    const dates: string[] = [];
    const current = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    while (current < end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 7);
    }

    return dates;
  }

  private buildDashboardInsights(input: {
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
    const throughputVariation = this.getVariation(input.weeklyThroughput);
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

  private getPercentileValue(values: number[], percentile: number) {
    if (values.length === 0) {
      return 0;
    }

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return Number(values[Math.max(0, Math.min(index, values.length - 1))].toFixed(2));
  }

  private getVariation(values: number[]) {
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

  private shiftIsoDate(dateValue: string, days: number) {
    const date = new Date(dateValue);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
  }

  private getIsoWeekBucket(dateValue: string) {
    const date = new Date(dateValue);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
    const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }

  private getUniqueSorted(values: string[]) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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
    const jiraConfig = this.getJiraConfig(input.jiraConfig);
    const issues = await this.getResolvedIssuesFromJira(input, jiraConfig);

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
      this.jiraService.getBoardColumnStatuses(boardId, startColumnName, jiraConfig),
      this.jiraService.getBoardColumnStatuses(boardId, endColumnName, jiraConfig)
    ]);

    const leadTimeIssues = await Promise.all(
      issues.map(async (issue) => {
        const changelog = await this.jiraService.getIssueChangelog(issue.key, jiraConfig);
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
    statusReferences: string[]
  ) {
    const matches = new Set(statusReferences.map((reference) => reference.toLowerCase()));

    for (const history of changelog) {
      const items = history.items ?? [];

      for (const item of items) {
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
