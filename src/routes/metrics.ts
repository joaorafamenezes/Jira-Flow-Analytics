import type { FastifyPluginAsync } from 'fastify';

const metricsRoutes: FastifyPluginAsync = async (app) => {
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
      priority: query.priority
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
      endColumnName: query.endColumnName
    });
  });
};

export default metricsRoutes;
