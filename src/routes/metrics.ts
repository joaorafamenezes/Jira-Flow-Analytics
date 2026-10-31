import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env';

function isValidIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isoDateString = z
  .string()
  .min(1, 'startDate and endDate are required')
  .refine(isValidIsoCalendarDate, {
    message: 'Dates must be valid calendar dates in YYYY-MM-DD format'
  });

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((val) => {
    const trimmed = val?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  });

const optionalCommaSeparatedString = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) {
      return undefined;
    }
    const items = val
      .split(/\r?\n|,|;/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return items.length > 0 ? items.join('\n') : undefined;
  });

const optionalBoardId = z
  .preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.coerce.number().int().positive('boardId must be a positive integer').optional()
  );

const jiraConfigFields = {
  jiraHost: optionalTrimmedString,
  jiraEmail: optionalTrimmedString,
  jiraApiToken: optionalTrimmedString,
  jiraProjectKey: optionalTrimmedString,
  jiraDefaultJql: optionalTrimmedString
};

const issueFilterFields = {
  issueType: optionalTrimmedString,
  squad: optionalTrimmedString,
  assignee: optionalTrimmedString,
  priority: optionalTrimmedString
};

const leadTimeConfigFields = {
  startMode: z.enum(['created', 'fieldDate', 'boardColumn'], {
    message: 'startMode must be created, fieldDate, or boardColumn'
  }).optional(),
  startFieldId: optionalTrimmedString,
  startFieldName: optionalTrimmedString,
  boardId: optionalBoardId,
  startColumnName: optionalTrimmedString,
  endColumnName: optionalTrimmedString
};

const baseDateAndSourceFields = {
  startDate: isoDateString,
  endDate: isoDateString,
  source: z.enum(['jira', 'mock'], {
    message: 'source must be jira or mock'
  }).default('jira')
};

const throughputQuerySchema = z.object({
  ...baseDateAndSourceFields,
  period: z.enum(['day', 'week', 'month'], {
    message: 'period must be day, week, or month'
  }).default('day'),
  ...issueFilterFields,
  ...jiraConfigFields,
  flowActiveStatuses: optionalCommaSeparatedString,
  flowInactiveStatuses: optionalCommaSeparatedString
});

const leadTimeQuerySchema = z.object({
  ...baseDateAndSourceFields,
  ...issueFilterFields,
  ...leadTimeConfigFields,
  ...jiraConfigFields,
  flowActiveStatuses: optionalCommaSeparatedString,
  flowInactiveStatuses: optionalCommaSeparatedString
});

const flowDashboardQuerySchema = z.object({
  ...baseDateAndSourceFields,
  throughputPeriod: z.enum(['week', 'month'], {
    message: 'throughputPeriod must be week or month'
  }).optional(),
  leadTimePeriod: z.enum(['week', 'month'], {
    message: 'leadTimePeriod must be week or month'
  }).optional(),
  ...issueFilterFields,
  ...leadTimeConfigFields,
  ...jiraConfigFields,
  flowActiveStatuses: optionalCommaSeparatedString,
  flowInactiveStatuses: optionalCommaSeparatedString
});

const filterOptionsQuerySchema = z.object({
  ...baseDateAndSourceFields,
  ...leadTimeConfigFields,
  ...jiraConfigFields
});

function parseQueryOrReply400<T extends z.ZodTypeAny>(
  schema: T,
  rawQuery: unknown,
  reply: FastifyReply
): z.infer<T> | null {
  const parsed = schema.safeParse(rawQuery);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const isMissingRequiredDate = firstIssue?.path.includes('startDate') || firstIssue?.path.includes('endDate');
    const message =
      isMissingRequiredDate && firstIssue?.code === 'invalid_type'
        ? 'startDate and endDate are required'
        : firstIssue?.message ?? 'Invalid query parameters';

    reply.code(400).send({ message });
    return null;
  }

  return parsed.data;
}

function getJiraConfigFromQuery(query: {
  jiraHost?: string;
  jiraEmail?: string;
  jiraApiToken?: string;
  jiraProjectKey?: string;
  jiraDefaultJql?: string;
}) {
  return {
    host: query.jiraHost,
    email: query.jiraEmail,
    apiToken: query.jiraApiToken,
    projectKey: query.jiraProjectKey,
    defaultJql: query.jiraDefaultJql
  };
}

const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/settings/jira-defaults', async () => ({
    jiraHost: env.JIRA_HOST,
    jiraEmail: env.JIRA_EMAIL,
    jiraApiToken: env.JIRA_API_TOKEN,
    jiraProjectKey: env.JIRA_PROJECT_KEY,
    jiraDefaultJql: env.JIRA_DEFAULT_JQL
  }));

  app.get('/metrics/overview', async () => app.metricsService.getOverview());

  app.get('/metrics/throughput', async (request, reply) => {
    const query = parseQueryOrReply400(throughputQuerySchema, request.query, reply);
    if (!query) {
      return;
    }

    return app.metricsService.getThroughputByPeriod({
      startDate: query.startDate,
      endDate: query.endDate,
      period: query.period,
      source: query.source,
      issueType: query.issueType,
      squad: query.squad,
      assignee: query.assignee,
      priority: query.priority,
      jiraConfig: getJiraConfigFromQuery(query)
    });
  });

  app.get('/metrics/lead-time', async (request, reply) => {
    const query = parseQueryOrReply400(leadTimeQuerySchema, request.query, reply);
    if (!query) {
      return;
    }

    return app.metricsService.getLeadTime({
      startDate: query.startDate,
      endDate: query.endDate,
      source: query.source,
      issueType: query.issueType,
      squad: query.squad,
      assignee: query.assignee,
      priority: query.priority,
      startMode: query.startMode,
      startFieldId: query.startFieldId,
      startFieldName: query.startFieldName,
      boardId: query.boardId,
      startColumnName: query.startColumnName,
      endColumnName: query.endColumnName,
      jiraConfig: getJiraConfigFromQuery(query)
    });
  });

  app.get('/metrics/flow-dashboard', async (request, reply) => {
    const query = parseQueryOrReply400(flowDashboardQuerySchema, request.query, reply);
    if (!query) {
      return;
    }

    return app.metricsService.getFlowDashboard({
      startDate: query.startDate,
      endDate: query.endDate,
      source: query.source,
      throughputPeriod: query.throughputPeriod,
      leadTimePeriod: query.leadTimePeriod,
      issueType: query.issueType,
      squad: query.squad,
      assignee: query.assignee,
      priority: query.priority,
      startMode: query.startMode,
      startFieldId: query.startFieldId,
      startFieldName: query.startFieldName,
      boardId: query.boardId,
      startColumnName: query.startColumnName,
      endColumnName: query.endColumnName,
      jiraConfig: getJiraConfigFromQuery(query),
      flowActiveStatuses: query.flowActiveStatuses,
      flowInactiveStatuses: query.flowInactiveStatuses
    });
  });

  app.get('/metrics/filter-options', async (request, reply) => {
    const query = parseQueryOrReply400(filterOptionsQuerySchema, request.query, reply);
    if (!query) {
      return;
    }

    return app.metricsService.getFilterOptions({
      startDate: query.startDate,
      endDate: query.endDate,
      source: query.source,
      startMode: query.startMode,
      boardId: query.boardId,
      startColumnName: query.startColumnName,
      endColumnName: query.endColumnName,
      startFieldId: query.startFieldId,
      jiraConfig: getJiraConfigFromQuery(query)
    });
  });
};

export default metricsRoutes;
