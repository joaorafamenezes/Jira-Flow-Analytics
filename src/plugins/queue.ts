import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Queue } from 'bullmq';
import { env } from '../config/env';

const queuePlugin: FastifyPluginAsync = async (app) => {
  const jiraSyncQueue = new Queue('jira-sync', {
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT
    }
  });

  jiraSyncQueue.on('error', (err) => {
    app.log.error(
      { err: err.message },
      'Erro na fila BullMQ: Não foi possível conectar ao Redis. Execute "npm run docker:up" ou "docker compose up -d".'
    );
  });

  app.decorate('jiraSyncQueue', jiraSyncQueue);

  app.addHook('onClose', async () => {
    await jiraSyncQueue.close();
  });
};

export default fp(queuePlugin, {
  name: 'queue-plugin'
});
