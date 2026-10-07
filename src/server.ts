import { buildApp } from './app';
import { env } from './config/env';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0'
    });

    if (env.NODE_ENV === 'development') {
      console.log('\x1b[36m%s\x1b[0m', '\n┌────────────────────────────────────────────────────────────────────────┐');
      console.log('\x1b[36m%s\x1b[0m', '│  🖥️   JIRA FLOW ANALYTICS - SERVIÇOS EM EXECUÇÃO                       │');
      console.log('\x1b[36m%s\x1b[0m', '├────────────────────────────────────────────────────────────────────────┤');
      console.log('\x1b[33m%s\x1b[0m', `│  • API Backend ativa em:  http://localhost:${env.PORT}                      │`);
      console.log('\x1b[32m%s\x1b[0m', '│  • Dashboard Web (UI):   http://localhost:4173                         │');
      console.log('\x1b[36m%s\x1b[0m', '│                                                                        │');
      console.log('\x1b[37m%s\x1b[0m', '│  👉 Para abrir a interface gráfica visual, execute em outro terminal:  │');
      console.log('\x1b[32m%s\x1b[0m', '│     npm run dev:ui                                                     │');
      console.log('\x1b[36m%s\x1b[0m', '│  💡 Ou use "npm run dev:all" para rodar Backend + Frontend juntos!    │');
      console.log('\x1b[36m%s\x1b[0m', '└────────────────────────────────────────────────────────────────────────┘\n');
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
