# Climate Change Explained: published files

Published to `thomassie/climate-change-explained` (GitHub Pages) by `.github/scripts/publish-pages.sh`. Embed: see
`HANDOVER-climate-change-explained.md` in the repository root.

| File | What it is |
|---|---|
| `index.html` | Standalone page |
| `embed-example.html` | The page inside a stand-in host page with hostile styles and a fixed header (test only, noindex) |
| `cce.js`, `cce.css` | The page: lead, timeline, day by day, why it warms (animated diagram), what warms and cools, how it shows up, your lifetime, where you live, what decides it, sources and method |
| `scrolly.js`, `theme.css`, `block3d.js`, `locator.js`, `world-50m.json` | Shared code, copied from `site/_shared/` by `tools/sync_shared.py` (`block3d.js` is not used by this page; `locator.js` draws the card's locator map and is loaded on demand if the embed does not list it) |
| `data/timeline.json`, `series.json`, `periods.json`, `scenarios.json`, `constants.json` | Temperature series (°C vs 1850-1900): reconstructions, measured land / sea surface / global, IPCC projections and our land/sea split; series metadata with sources; constants with sources |
| `data/landmarks.json` | Landmarks on the timeline (nature, history, policy, science, industry), each with a source |
| `data/daily.json` | ERA5 daily global air temperature per year since 1940 (Copernicus Climate Pulse), with each year's warming vs 1850-1900 |
| `data/co2.json`, `carbon.json`, `drivers.json`, `gases.json`, `sectors.json`, `countries.json`, `datasets.json`, `facts.json` | CO₂ (ice cores, Mauna Loa), global carbon budget, contributions to warming (IPCC SPM.2), emissions by gas, sector and country, dataset list with licences, cumulative CO₂ |
| `data/impacts.json`, `indicators.json` | Impacts (IPCC extremes per warming level; measured sea level, ice, ocean, health, people) and indicator series (Arctic sea ice, ocean heat) |
| `data/local.json` | Land temperature per country vs 1951-1980 (our averages of the Berkeley Earth 0.25° grid within Natural Earth borders) |
| `data/budgets.json`, `pathways.json` | Remaining carbon budgets (Forster et al. 2026) and emission cuts in IPCC pathways |
| `data/meta.json` | Export time (`generated_at`) |
| `og.png`, `figure-light.png`, `figure-dark.png` | Link preview and series figures (`tools/og/climate-change-explained.mjs`) |

Every number in the page's text is computed from these files. The climate cards for 24 places are built but switched
off (`PLACES = false` in `cce.js`) until their data exists (`pipeline/cce/place_climate.py`).
