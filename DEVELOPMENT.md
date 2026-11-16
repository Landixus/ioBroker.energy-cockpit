# Development

Use Node 22 or 24. `npm ci` is reproducible through the committed lockfile. `npm run build` compiles strict TypeScript and builds the original frontend. `npm test` runs calculation, history, battery-envelope and HTTP integration tests. `npm run lint` checks new source; upstream formatting is preserved. `npm run typecheck` checks the backend. Browser tests require `npx playwright install chromium`; Linux CI also installs browser OS dependencies.

`npm run test:browser` checks the standalone app with explicit synthetic readings. `npm run test:upstream` runs the original HTML tests; pages without assertions are recorded as smoke checks, not asserted suites. Test output belongs in ignored `test-results/`. Screenshots committed under `docs/screenshots/` contain only explicit demo data.

Use main for releasable commits, develop for integration and feature/fix branches for further work. The repository is separate from upstream because it adds a native adapter package, server and lifecycle. The upstream remote and pinned commit preserve provenance without pretending this is an official upstream release.

Before release run tests, dependency audit and `tools/secret-scan.mjs`, inspect `npm pack --dry-run`, then create a prerelease or release with a matching version. A passing local test is not evidence of production readiness: maintain the acceptance matrix in TEST_REPORT.md.

Never add local access files, remote inventories, telemetry dumps or database backups to Git. `.private/`, `secrets.txt`, `.env*` and generated packages are ignored. No source code reads `secrets.txt`; only private deployment tooling uses it.
