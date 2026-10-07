import type { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({
    message: 'Jira Flow Analytics API está online! 🚀',
    status: 'operational',
    endpoints: {
      health: 'GET /health',
      metricsOverview: 'GET /metrics/overview',
      enqueueSync: 'POST /jobs/sync',
      runSyncNow: 'POST /jobs/sync/run-now'
    },
    ui: 'Para visualizar o dashboard gráfico, execute "npm run dev:ui" e acesse http://localhost:4173'
  }));

  app.get('/health', async () => ({
    ok: true,
    service: 'jira-flow-analytics',
    timestamp: new Date().toISOString()
  }));
};

export default healthRoute;
