export const REMEDIATIONS: Record<string, { framework: string; code: string }[]> = {
  'SL-HSTS-001': [
    { framework: 'Next.js (next.config.js)', code: `module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }
        ],
      },
    ]
  },
}` },
    { framework: 'Nginx', code: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;` }
  ],
  'SL-CSP-001': [
    { framework: 'Next.js', code: `// In next.config.js headers()
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
}` },
    { framework: 'Express (Node.js)', code: `const helmet = require('helmet');
app.use(helmet.contentSecurityPolicy());` }
  ],
  'SL-COOP-001': [
    { framework: 'Express (Node.js)', code: `app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});` }
  ],
  'SL-COEP-001': [
    { framework: 'Express (Node.js)', code: `app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});` }
  ]
};
