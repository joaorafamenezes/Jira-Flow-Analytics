import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\x1b[36m%s\x1b[0m', '════════════════════════════════════════════════════════════════════════');
console.log('\x1b[36m%s\x1b[0m', '  🚀 INICIANDO JIRA FLOW ANALYTICS (BACKEND + FRONTEND CONCORRENTES)  ');
console.log('\x1b[36m%s\x1b[0m', '════════════════════════════════════════════════════════════════════════');
console.log('\x1b[33m%s\x1b[0m', '  • Backend API:        http://localhost:3000');
console.log('\x1b[32m%s\x1b[0m', '  • Frontend Dashboard: http://localhost:4173');
console.log('\x1b[36m%s\x1b[0m', '════════════════════════════════════════════════════════════════════════\n');

// Executa verificação prévia de Docker/Redis
import('./check-env.mjs');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows
});

const frontend = spawn(npmCmd, ['run', 'dev:ui'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows
});

const cleanup = (code = 0) => {
  try {
    if (isWindows) {
      if (backend.pid) spawn('taskkill', ['/pid', backend.pid.toString(), '/f', '/t']);
      if (frontend.pid) spawn('taskkill', ['/pid', frontend.pid.toString(), '/f', '/t']);
    } else {
      backend.kill('SIGTERM');
      frontend.kill('SIGTERM');
    }
  } catch {
    // ignora erros de encerramento
  }
  process.exit(code);
};

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));

backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend encerrou com código ${code}`);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend encerrou com código ${code}`);
  }
});
