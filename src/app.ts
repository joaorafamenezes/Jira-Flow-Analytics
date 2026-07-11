import Fastify from 'fastify';
import { env } from './config/env';
import jiraPlugin from './plugins/jira';
import queuePlugin from './plugins/queue';
import healthRoute from './routes/health';
import jobRoutes from './routes/jobs';
import metricsRoutes from './routes/metrics';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty'
          }
        : undefined
    }
  });

  await app.register(jiraPlugin);
  await app.register(queuePlugin);

  await app.register(healthRoute);
  await app.register(metricsRoutes);
  await app.register(jobRoutes);

  return app;
}
