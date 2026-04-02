import { spawn } from 'node:child_process';
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

async function main() {
  const usingDefaultDb = process.env.DATABASE_URL === defaultDatabaseUrl;
  const defaultDatabasePath = path.resolve(packageDir, 'prisma/dev.db');
  const shouldSeed = usingDefaultDb && (await getFileSize(defaultDatabasePath)) === 0;
  const port = Number(process.env.PORT ?? 3000);

  if (await isPortInUse(port)) {
    console.error(
      `backend dev: port ${port} is already in use, stop the existing server or run with PORT=${port + 1}`
    );
    process.exit(1);
  }

  if (usingDefaultDb) {
    console.info('backend dev: ensuring local sqlite schema');
    await run('pnpm', ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate']);

    if (shouldSeed) {
      console.info('backend dev: seeding local sqlite');
      await run('pnpm', ['seed']);
    }
  }

  console.info('backend dev: building backend once');
  await run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json']);

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

  const server = spawn('node', ['--watch', 'dist/src/main.js'], {
    cwd: packageDir,
    stdio: 'inherit',
    env: process.env
  });

  const closeChildren = (signal) => {
    compiler.kill(signal);
    server.kill(signal);
  };

  compiler.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    if (code !== 0) {
      closeChildren('SIGTERM');
      process.exit(code ?? 1);
    }
  });

  server.on('exit', (code, signal) => {
    if (signal) {
      compiler.kill(signal);
      process.kill(process.pid, signal);
      return;
    }

    compiler.kill('SIGTERM');
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    closeChildren('SIGINT');
  });

  process.on('SIGTERM', () => {
    closeChildren('SIGTERM');
  });
}

void main().catch((error) => {
  console.error('backend dev: failed to prepare local database');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
