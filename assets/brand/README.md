# SiteLens brand assets

The shield outline represents the inspection boundary; the lens represents evidence and investigation. The mark deliberately has no checkmark or security-certification badge.

- `logo.svg` / `logo.png`: primary horizontal logo for light backgrounds.
- `logo-light.svg` / `logo-light.png`: white wordmark for dark backgrounds.
- `mark.svg`: teal tile with white shield and lens.
- `mark-mono.svg`: transparent single-color teal mark.
- `favicon.svg` and `favicon.ico`: browser tab icons; ICO contains 16, 32 and 48 px images.
- `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`, `icon256.png`, `icon512.png`: transparent PNG icon exports.

Colors: SiteLens teal `#087f70`, ink `#0f172a`, white `#ffffff`. Keep a quarter of the mark's width clear around standalone use. Preserve proportions. PNG wordmarks are 1000 × 256 with transparent backgrounds.

SVG files are the source artwork. Regenerate raster assets with `npm run icons --workspace @sitelens/extension` (uses installed Chrome on Windows or the Playwright browser elsewhere; override `SITELENS_BRAND_BROWSER` if needed). Ordinary production builds use the committed assets and do not launch a browser. Builds copy the branding into both extension and dashboard bundles. Reports embed the vector mark directly so exported HTML and printed PDFs remain self-contained.
