import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
await build({entryPoints:['tests/core.test.ts'],outfile:'.test-build/core.test.mjs',bundle:true,platform:'node',format:'esm',target:'node22'});
execFileSync(process.execPath,['--test','.test-build/core.test.mjs'],{stdio:'inherit'});
