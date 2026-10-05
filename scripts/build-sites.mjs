import { cp, mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist/server'), { recursive: true });

run(resolve(root, 'node_modules/.bin/vite'), ['build', '--config', 'apps/web/vite.config.ts']);
run(resolve(root, 'node_modules/.bin/esbuild'), [
  'worker/index.ts',
  '--bundle',
  '--format=esm',
  '--platform=browser',
  '--target=es2022',
  '--outfile=dist/server/index.js',
]);

await mkdir(resolve(root, 'dist/.openai'), { recursive: true });
await cp(resolve(root, '.openai/hosting.json'), resolve(root, 'dist/.openai/hosting.json'));
