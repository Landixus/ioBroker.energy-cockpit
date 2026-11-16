# Changelog

## 0.1.0-alpha.4

- Reverse the 3D grid meter cable on import: energy leaves the meter toward the house. Export returns into the meter.
- Add persistent direction arrows and reduce maximum dotted-flow speed to make direction easier to read.
- Apply explicit accessible light/dark colors to the Admin configuration iframe, including legacy Admin theme overrides.
- Add browser checks for seven Admin themes and import/export/zero/missing grid power at desktop and mobile widths.

## 0.1.0-alpha.3

- Withhold causal energy explanations when mapped grid, home, generation or battery power is incomplete.
- Extend the missing-grid browser regression to cover explanatory text as well as percentages.

## 0.1.0-alpha.2

- Keep power units inside narrow 3D tiles on Linux system fonts.
- Reserve consistent space for statistics explanations across reporting periods.
- Preserve all existing layout assertions; add a targeted Linux regression workflow.

## 0.1.0-alpha.1

- Port original Energy-Cockpit 0.32.5 presentation to a native ioBroker adapter.
- Add authenticated standalone dashboard, source mappings, diagnostics and ten-step setup wizard.
- Add unit/sign/freshness validation and bounded read-only history translation.
- Preserve original MIT attribution, 3D rendering, animations, themes and responsive components.
- Add calculation, security and browser tests. Treat this release as an integration candidate; see the test report for limits.
