#!/usr/bin/env node
import puppeteer from 'puppeteer';
import fs from 'fs';
import { assess } from '@sitelens/assessment-engine';
import { CHECKS } from '@sitelens/rule-definitions';

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx sitelens <url>");
  process.exit(1);
}

console.log(`Starting headless SiteLens scan for ${url}...`);

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const response = await page.goto(url, { waitUntil: 'networkidle2' });
  const headers = response.headers();
  const statusCode = response.status();
  
  console.log("Extracting DOM metadata...");
  
  // Inject our collector logic
  const snapshot = await page.evaluate(() => {
    // Basic extraction mimicking collector.ts
    const resources = Array.from(document.querySelectorAll('script, link, img, iframe')).map(e => ({
      tag: e.tagName.toLowerCase(),
      src: (e as any).src || (e as any).href || '',
      integrity: e.getAttribute('integrity') || ''
    }));
    
    let local = 0, session = 0, keys = [];
    try { 
      local = localStorage.length; 
      for(let i=0;i<local;i++){ const k = localStorage.key(i); if(k) keys.push(k); }
    } catch {}
    
    return {
      url: window.location.href,
      origin: window.location.origin,
      storage: { local, session, keys },
      resources
    };
  });
  
  console.log("Running assessment engine...");
  
  // Create mock inputs for the engine
  const input = {
    page: {
      ...snapshot,
      forms: [], frames: [], htmlKeys: [], metadata: {}, scripts: [], urlKeys: [], windowKeys: [], indicators: [], secrets: [], probes: [], performance: null
    },
    response: {
      url, urlHash: 'mock', headers: headers as any, statusCode, collectedAt: new Date().toISOString(), requestId: '1', startedAt: Date.now(), redirects: []
    },
    cookies: { available: true, cookies: [], limitation: '' },
    browser: await browser.userAgent(),
    targetKey: 'headless'
  };

  const assessment = assess(input as any);
  
  const outPath = `sitelens-report-${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify(assessment, null, 2));
  
  console.log(`Scan complete! Findings: ${assessment.findings.length}`);
  console.log(`Report saved to ${outPath}`);
  
  await browser.close();
})();
