import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';

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
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      period?: 'day' | 'week' | 'month';
      source?: 'jira' | 'mock';
      issueType?: string;
      squad?: string;
      assignee?: string;
      priority?: string;
      jiraHost?: string;
      jiraEmail?: string;
      jiraApiToken?: string;
      jiraProjectKey?: string;
      jiraDefaultJql?: string;
      flowActiveStatuses?: string;
      flowInactiveStatuses?: string;
    };

    const startDate = query.startDate;
    const endDate = query.endDate;
    const period = query.period ?? 'day';
    const source = query.source ?? 'jira';

    if (!startDate || !endDate) {
      return reply.code(400).send({
        message: 'startDate and endDate are required'
      });
    }

    if (!['day', 'week', 'month'].includes(period)) {
      return reply.code(400).send({
        message: 'period must be day, week, or month'
      });
    }

    if (!['jira', 'mock'].includes(source)) {
      return reply.code(400).send({
        message: 'source must be jira or mock'
      });
    }

    return app.metricsService.getThroughputByPeriod({
      startDate,
      endDate,
      period,
      source,
      issueType: query.issueType,
      squad: query.squad,
      assignee: query.assignee,
      priority: query.priority,
      jiraConfig: getJiraConfigFromQuery(query)
    });
  });

  app.get('/metrics/lead-time', async (request, reply) => {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      source?: 'jira' | 'mock';
      issueType?: string;
      squad?: string;
      assignee?: string;
      priority?: string;
      startMode?: 'created' | 'fieldDate';
      startFieldId?: string;
      startFieldName?: string;
      boardId?: string;
      startColumnName?: string;
      endColumnName?: string;
      jiraHost?: string;
      jiraEmail?: string;
      jiraApiToken?: string;
      jiraProjectKey?: string;
      jiraDefaultJql?: string;
      flowActiveStatuses?: string;
      flowInactiveStatuses?: string;
    };

    const startDate = query.startDate;
    const endDate = query.endDate;
    const source = query.source ?? 'jira';
    const startMode = query.startMode;

    if (!startDate || !endDate) {
      return reply.code(400).send({
        message: 'startDate and endDate are required'
      });
    }

    if (!['jira', 'mock'].includes(source)) {
      return reply.code(400).send({
        message: 'source must be jira or mock'
      });
    }

    if (startMode && !['created', 'fieldDate', 'boardColumn'].includes(startMode)) {
      return reply.code(400).send({
        message: 'startMode must be created, fieldDate, or boardColumn'
      });
    }

    return app.metricsService.getLeadTime({
      startDate,
      endDate,
      source,
      issueType: query.issueType,
      squad: query.squad,
      assignee: query.assignee,
      priority: query.priority,
      startMode,
      startFieldId: query.startFieldId,
      startFieldName: query.startFieldName,
      boardId: query.boardId ? Number(query.boardId) : undefined,
      startColumnName: query.startColumnName,
      endColumnName: query.endColumnName,
      jiraConfig: getJiraConfigFromQuery(query)
    });
  });

  app.get('/metrics/flow-dashboard', async (request, reply) => {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      source?: 'jira' | 'mock';
      issueType?: string;
      squad?: string;
      assignee?: string;
      priority?: string;
      throughputPeriod?: 'week' | 'month';
      leadTimePeriod?: 'week' | 'month';
      startMode?: 'created' | 'fieldDate' | 'boardColumn';
      startFieldId?: string;
      startFieldName?: string;
      boardId?: string;
      startColumnName?: string;
      endColumnName?: string;
      jiraHost?: string;
      jiraEmail?: string;
      jiraApiToken?: string;
      jiraProjectKey?: string;
      jiraDefaultJql?: string;
      flowActiveStatuses?: string;
      flowInactiveStatuses?: string;
    };

    const startDate = query.startDate;
    const endDate = query.endDate;
    const source = query.source ?? 'jira';
    const startMode = query.startMode;
    const throughputPeriod = query.throughputPeriod;
    const leadTimePeriod = query.leadTimePeriod;

    if (!startDate || !endDate) {
      return reply.code(400).send({
        message: 'startDate and endDate are required'
      });
    }

    if (!['jira', 'mock'].includes(source)) {
      return reply.code(400).send({
        message: 'source must be jira or mock'
      });
    }

    if (startMode && !['created', 'fieldDate', 'boardColumn'].includes(startMode)) {
      return reply.code(400).send({
        message: 'startMode must be created, fieldDate, or boardColumn'
      });
    }

    if (throughputPeriod && !['week', 'month'].includes(throughputPeriod)) {
      return reply.code(400).send({
        message: 'throughputPeriod must be week or month'
      });
    }

    if (leadTimePeriod && !['week', 'month'].includes(leadTimePeriod)) {
      return reply.code(400).send({
        message: 'leadTimePeriod must be week or month'
      });
    }

    return app.metricsService.getFlowDashboard({
      startDate,
      endDate,
      source,
      throughputPeriod,
      leadTimePeriod,
      issueType: query.issueType,
      squad: query.squad,
      assignee: query.assignee,
      priority: query.priority,
      startMode,
      startFieldId: query.startFieldId,
      startFieldName: query.startFieldName,
      boardId: query.boardId ? Number(query.boardId) : undefined,
      startColumnName: query.startColumnName,
      endColumnName: query.endColumnName,
      jiraConfig: getJiraConfigFromQuery(query),
      flowActiveStatuses: query.flowActiveStatuses,
      flowInactiveStatuses: query.flowInactiveStatuses
    });
  });

  app.get('/metrics/filter-options', async (request, reply) => {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      source?: 'jira' | 'mock';
      startMode?: 'created' | 'fieldDate' | 'boardColumn';
      boardId?: string;
      startColumnName?: string;
      endColumnName?: string;
      startFieldId?: string;
      jiraHost?: string;
      jiraEmail?: string;
      jiraApiToken?: string;
      jiraProjectKey?: string;
      jiraDefaultJql?: string;
    };

    const startDate = query.startDate;
    const endDate = query.endDate;
    const source = query.source ?? 'jira';

    if (!startDate || !endDate) {
      return reply.code(400).send({
        message: 'startDate and endDate are required'
      });
    }

    if (!['jira', 'mock'].includes(source)) {
      return reply.code(400).send({
        message: 'source must be jira or mock'
      });
    }

    return app.metricsService.getFilterOptions({
      startDate,
      endDate,
      source,
      startMode: query.startMode,
      boardId: query.boardId ? Number(query.boardId) : undefined,
      startColumnName: query.startColumnName,
      endColumnName: query.endColumnName,
      startFieldId: query.startFieldId,
      jiraConfig: getJiraConfigFromQuery(query)
    });
  });
};

export default metricsRoutes;
