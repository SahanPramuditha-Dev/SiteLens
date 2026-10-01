import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../..');
const mark = await readFile(path.join(root, 'assets/brand/mark.svg'), 'utf8');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SITELENS_BRAND_BROWSER
    ? { executablePath: process.env.SITELENS_BRAND_BROWSER }
    : process.platform === 'win32'
      ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }
      : {}),
});
try {
  const page = await browser.newPage();
  await mkdir(path.join(root, 'apps/extension/icons'), { recursive: true });
  for (const size of [16, 32, 48, 128, 256, 512]) {
    const data = await page.evaluate(
      async ({ svg, size }) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;base64,' + btoa(svg);
        await img.decode();
        const hi = document.createElement('canvas');
        hi.width = hi.height = size * 4;
        hi.getContext('2d').drawImage(img, 0, 0, size * 4, size * 4);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(hi, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      },
      { svg: mark, size }
    );
    const png = Buffer.from(data, 'base64');
    await writeFile(path.join(root, `assets/brand/icon${size}.png`), png);
    await writeFile(path.join(root, `apps/extension/icons/icon${size}.png`), png);
  }
  for (const name of ['logo', 'logo-light']) {
    const svg = await readFile(path.join(root, 'assets/brand/' + name + '.svg'), 'utf8');
    const data = await page.evaluate(async (svg) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(svg);
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 256;
      canvas.getContext('2d').drawImage(img, 0, 0, 1000, 256);
      return canvas.toDataURL('image/png').split(',')[1];
    }, svg);
    await writeFile(path.join(root, 'assets/brand/' + name + '.png'), Buffer.from(data, 'base64'));
  }
  await writeFile(
    path.join(root, 'assets/brand/report-mark.ts'),
    '// Self-contained vector branding for portable HTML/PDF reports.\nexport const REPORT_MARK = ' +
      JSON.stringify(mark.replace('<svg ', '<svg width="40" height="40" aria-hidden="true" ')) +
      ';\n'
  );
  const sizes = [16, 32, 48],
    images = await Promise.all(
      sizes.map((s) => readFile(path.join(root, `assets/brand/icon${s}.png`)))
    );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  images.forEach((b, i) => {
    const p = 6 + i * 16;
    header[p] = header[p + 1] = sizes[i];
    header.writeUInt16LE(1, p + 4);
    header.writeUInt16LE(32, p + 6);
    header.writeUInt32LE(b.length, p + 8);
    header.writeUInt32LE(offset, p + 12);
    offset += b.length;
  });
  await writeFile(path.join(root, 'assets/brand/favicon.ico'), Buffer.concat([header, ...images]));
  console.log('Generated SiteLens PNG icons and multi-size favicon.');
} finally {
  await browser.close();
}
