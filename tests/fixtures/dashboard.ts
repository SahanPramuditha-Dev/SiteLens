import { assess } from '@sitelens/assessment-engine';
const now = new Date().toISOString();
export default {
  assessments: [
    assess({
      page: {
        url: 'https://fixture.example',
        timeOrigin: 1,
        resources: [
          'https://fixture.example/_next/static/app.js',
          'https://fixture.example/wp-content/themes/fixture/style.css',
          'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
          'https://js.stripe.com/v3/',
          'https://www.googletagmanager.com/gtm.js',
          'https://fonts.googleapis.com/css2',
          'https://browser.sentry-cdn.com/bundle.js',
        ].map((url) => ({
          url,
          type: url.includes('css') ? 'link' : 'script',
          integrity: null,
          crossorigin: null,
        })),
        forms: [],
        frames: [],
        indicators: [],
        technologyMeta: [{ name: 'generator', content: 'WordPress 6.8.1' }],
        metaCsp: [],
        metaReferrer: null,
        blankLinks: 0,
        storage: { local: 0, session: 0 },
        limits: [],
        collectedAt: now,
      },
      response: null,
      cookies: { available: false, cookies: [], limitation: 'Fixture' },
      browser: 'Fixture',
      targetKey: 'fixture',
    }),
  ],
  events: [],
  settings: { learningMode: false, retention: 50, observedOrigins: [] },
};
