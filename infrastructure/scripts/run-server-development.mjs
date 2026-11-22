import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const target = process.argv[2];
const entries = {
  api: 'dist/apps/api/src/main.js',
  worker: 'dist/apps/worker/src/main.js',
};

if (!(target in entries)) {
  console.error('Usage: node infrastructure/scripts/run-server-development.mjs <api|worker>');
  process.exit(1);
}

const typescriptCompiler = path.join(projectRoot, 'node_modules/typescript/bin/tsc');
const entry = path.join(projectRoot, entries[target]);

function spawnProcess(command, argumentsList) {
  return spawn(command, argumentsList, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

const initialCompilation = spawnProcess(process.execPath, [
  typescriptCompiler,
  '-p',
  'tsconfig.server.json',
]);
const initialResult = await waitForExit(initialCompilation);

if (initialResult.code !== 0) {
  process.exit(initialResult.code ?? 1);
}

const compiler = spawnProcess(process.execPath, [
  typescriptCompiler,
  '-p',
  'tsconfig.server.json',
  '--watch',
  '--preserveWatchOutput',
]);
const application = spawnProcess(process.execPath, ['--watch', '--watch-preserve-output', entry]);

let stopping = false;

function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  compiler.kill(signal);
  application.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

const result = await Promise.race([waitForExit(compiler), waitForExit(application)]);
stop();
process.exitCode = result.code ?? (result.signal ? 1 : 0);
