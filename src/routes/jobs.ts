import type { FastifyPluginAsync } from 'fastify';

const jobRoutes: FastifyPluginAsync = async (app) => {
  app.post('/jobs/sync', async () => {
    const job = await app.jiraSyncQueue.add('sync-project', {
      projectKey: 'default',
      requestedAt: new Date().toISOString()
    });

    return {
      queued: true,
      jobId: job.id
    };
  });

  app.post('/jobs/sync/run-now', async () => app.ingestionService.runInitialSync());
};

export default jobRoutes;
