import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const defaultDatabaseUrl = 'file:./dev.db';

process.env.DATABASE_URL ??= defaultDatabaseUrl;

async function getFileSize(filePath) {
  try {
    const info = await stat(filePath);
    return info.size;
  } catch {
    return 0;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: packageDir,
      stdio: 'inherit',
      env: process.env
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command exited with signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
        return;
      }

      resolve(undefined);
    });
  });
}

function isPortInUse(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(true);
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close(() => resolve(false));
    });

    server.listen(port, '::');
  });
}

/**
 * Wait until the given port is free, polling every `interval` ms.
 * Gives up after `timeout` ms and rejects.
 */
async function waitForPortFree(port, { timeout = 5000, interval = 150 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await isPortInUse(port))) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Port ${port} was not released within ${timeout}ms`);
}

async function waitForChildExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) {
      resolve(true);
      return;
    }

    const timeout = setTimeout(() => {
      child.removeListener('exit', onExit);
      resolve(false);
    }, timeoutMs);

    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };

    child.once('exit', onExit);
  });
}

async function terminateChildProcess(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill(signal);
  const exited = await waitForChildExit(child, 1500);

  if (!exited && child.exitCode === null) {
    child.kill('SIGKILL');
    await waitForChildExit(child, 1500);
  }
}

// ─── Managed server process ──────────────────────────────────────────────

let serverChild = null;
let restarting = false;
let pendingRestart = false;
let stopping = false;
let shuttingDown = false;
const port = Number(process.env.PORT ?? 3000);

function startServer() {
  const child = spawn('node', ['dist/src/main.js'], {
    cwd: packageDir,
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', (code, signal) => {
    // Only log unexpected exits (not from our own kill)
    if (!restarting && !stopping) {
      console.error(
        `backend dev: server exited unexpectedly (code=${code}, signal=${signal}), waiting for file change to restart`
      );
    }
  });

  serverChild = child;
  return child;
}

async function restartServer() {
  if (restarting) {
    // Coalesce rapid successive restarts
    pendingRestart = true;
    return;
  }

  restarting = true;

  try {
    // 1. Kill old server
    if (serverChild && serverChild.exitCode === null) {
      await terminateChildProcess(serverChild, 'SIGTERM');
    }

    // 2. Wait until the port is actually free
    await waitForPortFree(port);

    // 3. Start new server
    startServer();
  } catch (error) {
    console.error('backend dev: restart failed:', error.message);
  } finally {
    restarting = false;

    // If a new change arrived while we were restarting, restart again
    if (pendingRestart) {
      pendingRestart = false;
      await restartServer();
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  const isLocalSqlite = process.env.DATABASE_URL.startsWith('file:');
  const databaseFileName = process.env.DATABASE_URL.replace(
    'file:./',
    ''
  ).replace('file:', '');
  const currentDatabasePath = path.resolve(
    packageDir,
    'prisma',
    databaseFileName
  );
  const shouldSeed =
    isLocalSqlite && (await getFileSize(currentDatabasePath)) === 0;

  if (await isPortInUse(port)) {
    console.error(
      `backend dev: port ${port} is already in use, stop the existing server or run with PORT=${port + 1}`
    );
    process.exit(1);
  }

  if (isLocalSqlite) {
    console.info('backend dev: ensuring local sqlite schema');
    await run('pnpm', [
      'prisma',
      'db',
      'push',
      '--accept-data-loss',
      '--skip-generate'
    ]);

    console.info('backend dev: generating prisma client');
    await run('pnpm', ['prisma', 'generate']);

    if (shouldSeed) {
      console.info('backend dev: seeding local sqlite');
      await run('pnpm', ['seed']);
    }
  }

  console.info('backend dev: building backend once');
  await run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json']);

  // ── Start tsc in watch mode ──────────────────────────────────────────
  const compiler = spawn(
    'pnpm',
    [
      'exec',
      'tsc',
      '-p',
      'tsconfig.build.json',
      '--watch',
      '--preserveWatchOutput'
    ],
    {
      cwd: packageDir,
      stdio: 'inherit',
      env: process.env
    }
  );

  // ── Start server (first time) ────────────────────────────────────────
  startServer();

  // ── Watch dist/ for changes and restart server ───────────────────────
  // Use a debounce so that a batch of TSC file writes only triggers one restart
  let debounceTimer = null;
  const distDir = path.resolve(packageDir, 'dist');

  const distWatcher = watch(distDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    // Only restart on .js file changes (skip .d.ts, source maps, etc.)
    if (!filename.endsWith('.js')) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      console.info('backend dev: dist changed, restarting server...');
      void restartServer();
    }, 300);
  });

  // ── Process lifecycle ────────────────────────────────────────────────
  compiler.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    if (code !== 0) {
      stopping = true;
      if (serverChild) serverChild.kill('SIGTERM');
      process.exit(code ?? 1);
    }
  });

  const cleanup = async (signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopping = true;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    distWatcher.close();

    await Promise.allSettled([
      terminateChildProcess(compiler, signal),
      terminateChildProcess(serverChild, signal)
    ]);

    process.exit(0);
  };

  process.on('SIGINT', () => {
    void cleanup('SIGINT');
  });
  process.on('SIGTERM', () => {
    void cleanup('SIGTERM');
  });
}

void main().catch((error) => {
  console.error('backend dev: failed to prepare local database');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
