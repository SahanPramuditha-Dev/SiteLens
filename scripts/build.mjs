import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(args, cwd) {
  if (process.env.npm_execpath)
    execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, stdio: 'inherit' });
  else execFileSync(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
}
run(['run', 'build'], 'apps/extension');
run(['run', 'build'], 'apps/dashboard');
await build({
  entryPoints: ['apps/cli/src/index.ts'],
  outfile: 'apps/cli/dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['playwright'],
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});
console.log('Built extension, dashboard and CLI.');
