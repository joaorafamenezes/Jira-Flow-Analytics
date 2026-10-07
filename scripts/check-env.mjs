import net from 'node:net';

function checkPort(port, host = '127.0.0.1', timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const cleanup = () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });

    socket.once('timeout', () => {
      cleanup();
      resolve(false);
    });

    socket.once('error', () => {
      cleanup();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function main() {
  const redisPort = Number(process.env.REDIS_PORT || 6379);
  const redisHost = process.env.REDIS_HOST || '127.0.0.1';
  const isRedisUp = await checkPort(redisPort, redisHost);

  if (!isRedisUp) {
    const yellow = '\x1b[33m';
    const cyan = '\x1b[36m';
    const bold = '\x1b[1m';
    const reset = '\x1b[0m';

    console.log(`\n${yellow}${bold}┌────────────────────────────────────────────────────────────────────────┐${reset}`);
    console.log(`${yellow}${bold}│  ⚠️   LEMBRETE: DEPENDÊNCIAS DOCKER OFFLINE                            │${reset}`);
    console.log(`${yellow}${bold}├────────────────────────────────────────────────────────────────────────┤${reset}`);
    console.log(`${yellow}│  O Redis não está respondendo em ${redisHost}:${redisPort}.                       │${reset}`);
    console.log(`${yellow}│  A aplicação depende do Redis (BullMQ) para processamento em fila.     │${reset}`);
    console.log(`${yellow}│                                                                        │${reset}`);
    console.log(`${yellow}│  ${cyan}${bold}Execute para subir os containers:${reset}${yellow}                                     │${reset}`);
    console.log(`${yellow}│  👉 ${cyan}${bold}npm run docker:up${reset}${yellow}   (ou: docker compose up -d)                      │${reset}`);
    console.log(`${yellow}│                                                                        │${reset}`);
    console.log(`${yellow}│  💡 Se o Docker Desktop estiver fechado, abra-o antes de executar.    │${reset}`);
    console.log(`${yellow}${bold}└────────────────────────────────────────────────────────────────────────┘${reset}\n`);
  }
}

main().catch(() => {});
