import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, readFile, readdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const target of ['dist/brand', '../dashboard/public/brand']) {
  await mkdir(target, { recursive: true });
  for (const file of await readdir('../../assets/brand'))
    if (/\.(svg|png|ico)$/.test(file))
      await copyFile('../../assets/brand/' + file, target + '/' + file);
}
await copyFile('../../assets/brand/favicon.svg', '../dashboard/public/favicon.svg');
for (const target of ['dist/technologies', '../dashboard/public/technologies']) {
  await mkdir(target, { recursive: true });
  for (const file of await readdir('../../assets/technologies'))
    if (/\.(svg|png|md)$/.test(file) || file === 'SOURCES.json')
      await copyFile('../../assets/technologies/' + file, target + '/' + file);
}
await build({
  entryPoints: {
    background: 'src/background.ts',
    app: 'src/app.ts',
    popup: 'src/popup.ts',
    report: 'src/report-page.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  target: 'chrome132',
  sourcemap: true,
});
for (const file of ['manifest.json', 'dashboard.html', 'popup.html', 'report.html', 'style.css'])
  await copyFile(file, `dist/${file}`);
await mkdir('dist/icons', { recursive: true });
for (const size of [16, 32, 48, 128])
  await copyFile(`icons/icon${size}.png`, `dist/icons/icon${size}.png`);
await writeFile(
  'dist/build-info.json',
  JSON.stringify(
    {
      version: JSON.parse(await readFile('package.json', 'utf8')).version,
      source: 'src',
      builtAt: new Date().toISOString(),
    },
    null,
    2
  )
);
console.log('Built unpacked extension in dist/.');
