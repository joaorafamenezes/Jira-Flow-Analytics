import type { Queue } from 'bullmq';
import type { IngestionService } from '../modules/ingestion/ingestion-service';
import type { JiraService } from '../modules/jira/jira-service';
import type { MetricsService } from '../modules/metrics/metrics-service';

declare module 'fastify' {
  interface FastifyInstance {
    jiraService: JiraService;
    ingestionService: IngestionService;
    metricsService: MetricsService;
    jiraSyncQueue: Queue;
  }
}
