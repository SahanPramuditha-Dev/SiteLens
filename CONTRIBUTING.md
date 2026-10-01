# Contributing to SiteLens

Thank you for your interest in contributing to SiteLens! We welcome community contributions to improve the extension, dashboard, CLI, and shared packages.

## Getting Started

SiteLens requires Node.js 22 or newer and npm. 

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SahanPramuditha-Dev/SiteLens.git
   cd SiteLens
   ```

2. **Install dependencies:**
   ```bash
   npm ci
   ```

3. **Build the project:**
   ```bash
   npm run check
   ```

4. **Load the extension locally:**
   Open your Chromium-based browser (Chrome or Edge), go to `chrome://extensions` or `edge://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `apps/extension/dist` directory.

## Testing

SiteLens has an extensive test suite for the UI, CLI, and browser extensions.

To run the full test suite:
```bash
npm test
```

### Specific Tests
- UI tests (using generated assessment fixtures): `npm run test:ui`
- CLI tests (using local fixtures): `npm run test:cli`
- Browser extension tests: 
  Ensure Playwright browsers are installed (`npx playwright install chromium`) and run:
  ```bash
  npm run test:browser
  ```
  Note: Browser tests rely on installed Chrome or Edge depending on the test environment. You can set the `SITELENS_TEST_BROWSER` environment variable if needed.

## Architecture Overview

The repository is structured as follows:
- `apps/extension`: The core Chrome Manifest V3 extension containing background coordination, collection, persistence, popup, and reports.
- `apps/dashboard`: A React workspace for visualizing findings.
- `apps/cli`: A browser-backed command line interface.
- `packages/*`: Shared modules separating models, rules, evidence, findings, assessments, and reporting.

Note that collection (data gathering) and evaluation (assessing data against rules) remain strictly separated.

## Pull Requests

1. Fork the repository and create your branch from `main`.
2. Ensure your code passes all type checks and linting (`npm run check`).
3. Add tests for new features or bug fixes.
4. Update relevant documentation (README, etc.) if applicable.
5. Create a descriptive pull request summarizing your changes.

## Code of Conduct

By participating in this project, you agree to abide by common open-source codes of conduct. Please be respectful and considerate of other contributors.
