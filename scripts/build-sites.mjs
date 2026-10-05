import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
  '--outfile=dist/server/worker.js',
]);

const mimeType = (filename) => {
  if (filename.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filename.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filename.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filename.endsWith('.svg')) return 'image/svg+xml';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
};

const assetDirectory = resolve(root, 'dist/client');
const assets = {};
const collectAssets = async (directory, prefix = '') => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) await collectAssets(filename, relative);
    else assets[relative] = { body: (await readFile(filename)).toString('base64url'), contentType: mimeType(entry.name) };
  }
};
await collectAssets(assetDirectory);
const worker = await readFile(resolve(root, 'dist/server/worker.js'), 'utf8');
await writeFile(resolve(root, 'dist/server/index.js'), `globalThis.__BUTTERFLY_ASSETS__=${JSON.stringify(assets)};\n${worker}`);

await mkdir(resolve(root, 'dist/.openai'), { recursive: true });
await cp(resolve(root, '.openai/hosting.json'), resolve(root, 'dist/.openai/hosting.json'));
