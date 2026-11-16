# Source provenance

Port of https://github.com/msucimaker3112/energy-cockpit

Upstream version: 0.32.5
Commit: ca11fc4cc25911fbfaa0829000e874ae5ef96e27

Copyright (c) 2026 Musicmaker3112. MIT license preserved in LICENSE.
Original presentation sources are in frontend/upstream; original browser tests in test/upstream.
Adapter scaffold generated using @iobroker/create-adapter 3.1.5.

This is a separate adapter repository because its npm layout, lifecycle and standalone server differ from the Home Assistant distribution. The complete upstream checkout was inspected locally; the pinned source and relevant tests are retained here. Unneeded upstream documentation images, PDF and branding photographs are excluded because their independent asset licensing was not established. The original 3D house is source-generated SVG, not a copied screenshot. System fonts and licensed MDI SVG icons are used.

## Home Assistant dependency map

| Original dependency | ioBroker replacement / limit |
| --- | --- |
| `hass.states`, entity IDs | Normalized mapped state cache with stable `sensor.<key>` aliases |
| `hass.callWS` recorder statistics | Authenticated history bridge via existing history adapter |
| `hass.callService` | Explicitly disabled; no guessed device commands |
| Lovelace configuration/editor lifecycle | Standalone custom-element host and persistent native settings |
| HA theme, locale, currency | German host, local themes, EUR and Europe/Berlin |
| more-info event | Read-only measurement/history dialog |
| HA weather/calendar APIs | Unavailable; no fabricated forecast/calendar data |

The upstream `src`, `dist`, `docs`, `test`, `tools`, build metadata, README and license were inspected. The distribution is rebuilt from original component source rather than vendoring a screenshot or substituting a generic dashboard.

## Deliberate changes to upstream code

`flow-card.js`: optional `strict_data` disables household inference from missing measurements, prevents partial PV aggregates and suppresses combined SOC when multiple battery capacities are unknown. It also wraps long 3D status tags and uses a consistent SOC line height to avoid clipping with system fonts at large text sizes.

Strict mode also withholds partial battery power and live autarky/self-consumption when the grid measurement is missing. Voltage-only battery profiles remain visible with unknown power/SOC instead of disappearing.

The explanation dialog reports an incomplete energy balance whenever a required power source is unknown; it must not interpret an absent source as zero or assert an unmeasured cause.

The 3D power value can wrap its unit at very narrow widths. `stats-card.js` reserves two lines for cost explanations, preventing a height jump when the selected period lacks cost history. These fixes address Linux font metrics without relaxing the original layout assertions.

`test/upstream/flow-big.html`: measure the large consumer tile before mounting the comparison card. The original test read its width after removing it from the DOM, producing zero. The assertion itself is retained.

No Home Assistant service is silently implemented as a guessed ioBroker control. Weather/calendar dependencies remain explicitly unavailable. The original test CDN is intercepted by the browser test runner and served from locally licensed MDI assets.

The build replaces original `new Date(...)` calendar constructors with a Europe/Berlin-bound TZDate subclass. Epoch timestamps and Date.parse/Date.now retain their standard meaning. @date-fns/tz is MIT licensed and its license is shipped in the frontend build. Enlarged consumer columns now scale with label size instead of remaining fixed-width.
