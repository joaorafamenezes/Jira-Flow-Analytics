import type { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    ok: true,
    service: 'jira-flow-analytics',
    timestamp: new Date().toISOString()
  }));
};

export default healthRoute;
