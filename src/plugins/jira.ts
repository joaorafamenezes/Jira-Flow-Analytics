import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { IngestionService } from '../modules/ingestion/ingestion-service';
import { createJiraClient } from '../modules/jira/jira-client';
import { JiraService } from '../modules/jira/jira-service';
import { MetricsService } from '../modules/metrics/metrics-service';

const jiraPlugin: FastifyPluginAsync = async (app) => {
  const jiraClient = createJiraClient();
  const jiraService = new JiraService(jiraClient);
  const ingestionService = new IngestionService(jiraService);
  const metricsService = new MetricsService(jiraService);

  app.decorate('jiraService', jiraService);
  app.decorate('ingestionService', ingestionService);
  app.decorate('metricsService', metricsService);
};

export default fp(jiraPlugin, {
  name: 'jira-plugin'
});
