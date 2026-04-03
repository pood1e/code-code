import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const viteEntrypoint = fileURLToPath(
  new URL('../node_modules/vite/bin/vite.js', import.meta.url)
);

const child = spawn(process.execPath, [viteEntrypoint, '--clearScreen=false'], {
  stdio: ['inherit', 'pipe', 'pipe']
});

let lastProxyErrorAt = 0;
let suppressProxyTrace = false;

function shouldThrottleProxyError() {
  const now = Date.now();
  if (now - lastProxyErrorAt < 3000) {
    return true;
  }

  lastProxyErrorAt = now;
  return false;
}

function forwardLine(line, write) {
  if (line.includes('[vite] http proxy error:')) {
    suppressProxyTrace = true;
    if (!shouldThrottleProxyError()) {
      write(
        `frontend dev: api proxy unavailable, backend may still be starting on ${process.env.VITE_API_URL || 'http://localhost:3000'}\n`
      );
    }
    return;
  }

  if (suppressProxyTrace) {
    if (
      line.startsWith('AggregateError [ECONNREFUSED]') ||
      line.startsWith('    at ') ||
      line.trim() === ''
    ) {
      return;
    }

    suppressProxyTrace = false;
  }

  write(`${line}\n`);
}

function pipeLines(stream, write) {
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    forwardLine(line, write);
  });
}

pipeLines(child.stdout, (line) => process.stdout.write(line));
pipeLines(child.stderr, (line) => process.stderr.write(line));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
