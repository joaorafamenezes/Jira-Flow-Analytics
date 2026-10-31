import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';

const jobRoutes: FastifyPluginAsync = async (app) => {
  app.post('/jobs/sync', async () => {
    const projectKey = env.JIRA_PROJECT_KEY || 'default';
    const deterministicJobId = `sync-project:${projectKey}`;

    const job = await app.jiraSyncQueue.add(
      'sync-project',
      {
        projectKey,
        requestedAt: new Date().toISOString()
      },
      {
        jobId: deterministicJobId
      }
    );

    return {
      queued: true,
      jobId: job.id
    };
  });

  app.post('/jobs/sync/run-now', async () => app.ingestionService.runInitialSync());
};

export default jobRoutes;
