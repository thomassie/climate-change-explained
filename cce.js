/* Climate Change Explained: where we come from, where we are, where we are heading.
   A timeline of Earth's temperature from the last ice age to 2100 that zooms as the reader scrolls, with landmarks
   (nature, history, policy, science, industry) that appear as the view narrows.

   <div id="climate-change-explained"> options:
     data-base        where data/ lives (default: this page's folder)
     data-header      "false" hides the page's own title (the host page has one)
     data-layout      "standalone" adds the page's own width and gutters
     data-sticky-top  height in px of a fixed header on the host page
   Every number in the text comes from data/*.json (exported from MotherDuck marts by pipeline/run.py).
   All temperatures are °C relative to 1850-1900. Before 1850 there is only a global reconstruction; from 1850 land
   and sea surface are measured separately; their projections are our split of the IPCC global projection. */
(function () {
  'use strict';
  const root = document.getElementById('climate-change-explained');
  if (!root) return;
  const base = root.dataset.base || '';
  root.classList.add('cce');
  root.style.setProperty('--sticky-top', (parseFloat(root.dataset.stickyTop || '0') || 0) + 'px');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : d3.format(`,.${d}f`)(v));
  const sgn = (v, d = 1) => (v >= 0 ? '+' : '−') + fmt(Math.abs(v), d);
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NOW = 2025;   // last full year of the measured series (checked against the data below)

  const files = ['timeline', 'series', 'landmarks', 'periods', 'constants', 'scenarios', 'meta',
    'datasets', 'co2', 'carbon', 'drivers', 'gases', 'sectors', 'countries', 'impacts', 'indicators', 'local', 'budgets', 'pathways', 'facts', 'daily'];
  // Climate cards for 24 places: parked until the Copernicus Atlas data is downloaded (pipeline/cce/place_climate.py).
  // Set to true once data/places.json is exported; until then the section is left out and nothing is requested.
  const PLACES = true;
  const optional = PLACES ? fetch(`${base}data/places.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null);
  Promise.all([...files.map((f) => fetch(`${base}data/${f}.json`).then((r) => { if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`); return r.json(); })), optional])
    .then((d) => build(...d))
    .catch((e) => { root.innerHTML = `<p class="cce-note">The data could not be loaded (${esc(e.message)}).</p>`; });

  function build(timeline, series, landmarks, periods, constants, scenarios, meta, datasets, co2, carbon, drivers, gases, sectors, countries, impacts, indicators, local, budgets, pathways, facts, daily, places) {
    // ---------- data helpers ----------
    const S = d3.group(timeline, (r) => r.s);
    S.forEach((a) => a.sort((p, q) => p.y - q.y));
    const SER = new Map(series.map((s) => [s.series_id, s]));
    const C = new Map(constants.map((c) => [c.id, c]));
    const SC = new Map(scenarios.map((s) => [s.scenario_id, s]));
    const SSPS = ['ssp126', 'ssp245', 'ssp585'].filter((s) => SC.has(s));
    const pts = (sid) => S.get(sid) || [];
    const css = (v) => getComputedStyle(root).getPropertyValue(v).trim();
    // Colours computed in JS (stripes, daily lines, ramps) are redrawn when the theme changes: the host's data-theme on
    // <html> or the system setting.
    const themeHooks = [];
    const onTheme = () => requestAnimationFrame(() => themeHooks.forEach((f) => f()));
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', onTheme);
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mean = (sid, a, b, k = 'v') => d3.mean(pts(sid).filter((r) => r.y >= a && r.y <= b), (r) => r[k]);
    const near = (sid, y) => pts(sid).reduce((best, r) => (!best || Math.abs(r.y - y) < Math.abs(best.y - y) ? r : best), null);
    const src = (sid, text) => { const s = SER.get(sid); return s ? `<a href="${esc(s.source_url)}">${esc(text || s.source)}</a>` : ''; };
    const lastObs = d3.max(pts('obs_global'), (r) => r.y);
    const ratio = C.get('land_ocean_ratio'), landShare = C.get('land_fraction');
    const split = (g, r = ratio.value) => { const o = g / (landShare.value * r + 1 - landShare.value); return { land: r * o, sea: o }; };
    const per = (code, p) => periods.find((r) => r.scenario === code && r.period === p);
    let cur = 'ssp245';
    let cardHook = null;   // set by the place cards when places.json exists

    // ---------- page ----------
    root.innerHTML = `
      ${root.dataset.header === 'false' ? '' : `<header class="cce-head">
        <h1>Climate Change Explained</h1>
        <p class="cce-dek">Where we come from, where we are, and where we are heading: Earth’s temperature from the last ice age to 2100.</p>
      </header>`}
      <nav class="cce-nav" id="cce-nav" aria-label="On this page">
        <a href="#cce-lead">Warming so far and ahead</a><a href="#cce-timeline-h">24,000 years in one chart</a><a href="#cce-daily-h">Day by day</a><a href="#cce-causes-h">Why it warms</a><a href="#cce-drivers-h">What warms, what cools</a><a href="#cce-countries-h">Which countries</a><a href="#cce-impacts-h">How it shows up</a><a href="#cce-life-h">Your lifetime</a><a href="#cce-local-h">Where you live</a>${places ? `<a href="#cce-places-h">${places.length} places</a>` : ''}<a href="#cce-decide-h">What decides it</a><a href="#cce-method-h">Sources and method</a>
      </nav>
      <section class="cce-lead" id="cce-lead" aria-labelledby="cce-lead-h">
        <h2 id="cce-lead-h">How much warmer</h2>
        <div class="cce-tabs" role="group" aria-label="Emissions scenario"></div>
        <p class="cce-lead__scen" aria-live="polite"></p>
        <div class="cce-hero">
          <div class="cce-hero__item"><p class="cce-hero__label"><i class="cce-sw cce-sw--ink"></i><span id="cce-hero-now-l"></span></p>
            <p class="cce-hero__figure" id="cce-hero-now"></p><p class="cce-hero__text" id="cce-hero-now-text"></p></div>
          <div class="cce-hero__item"><p class="cce-hero__label"><i class="cce-sw cce-sw--red"></i>By 2081–2100</p>
            <p class="cce-hero__figure" id="cce-hero-2100" aria-live="polite"></p><p class="cce-hero__text" id="cce-hero-2100-text"></p></div>
        </div>
      </section>
      <section class="cce-timeline-sec" aria-labelledby="cce-timeline-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <h2 id="cce-timeline-h">24,000 years in one chart</h2>
        <p class="cce-intro">Scroll to zoom from the last ice age to today, and on to 2100. Lines mark events in nature
          and history, and when scientists and oil companies knew about the greenhouse effect: tap or hover over one to read more.</p>
        <div class="story">
          <div class="story__graphic">
            <div class="cce-tabs cce-graphic-tabs" role="group" aria-label="Emissions scenario" hidden></div>
            <a class="cce-skip" href="#cce-lm-all">Skip the chart: all landmarks as a list</a>
            <div class="cce-chart" id="cce-chart"></div>
            <div class="cce-legend" aria-hidden="true"></div>
            <div class="cce-kinds" role="group" aria-label="Show landmarks"></div>
          </div>
          <div class="story__steps"></div>
        </div>
        <details class="cce-lm-all" id="cce-lm-all"><summary></summary><div class="cce-lm-all__scroll"><table></table></div></details>
      </section>
      <section class="cce-daily" aria-labelledby="cce-daily-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-daily-h">Day by day</h2>
          <div class="cce-prose" id="cce-daily-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig">
            <h3>Global air temperature on every day since <span id="cce-daily-y0"></span></h3>
            <div class="cce-mini cce-mini--tall" id="cce-daily"></div>
            <div class="cce-legend" id="cce-daily-leg"></div>
            <figcaption class="cce-src" id="cce-daily-cap"></figcaption>
          </figure>
        </div></div>
      </section>
      <section class="cce-causes" aria-labelledby="cce-causes-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-causes-h">Why it warms</h2>
          <div class="cce-prose" id="cce-ghe-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig cce-ghe" id="cce-ghe"></figure>
        </div></div>
        <div class="block"><div class="block__rail">
          <h3>More CO₂ than in 800,000 years</h3>
          <div class="cce-prose" id="cce-co2-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig">
            <div class="cce-pair"><div class="cce-mini" id="cce-co2-long"></div><div class="cce-mini" id="cce-co2-short"></div></div>
            <div class="cce-legend" id="cce-co2-leg"></div><figcaption class="cce-src" id="cce-co2-cap"></figcaption>
          </figure>
        </div></div>
        <div class="block"><div class="block__rail">
          <h3>Where the CO₂ goes</h3>
          <div class="cce-prose" id="cce-sink-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig">
            <div class="cce-mini cce-mini--tall" id="cce-sinks"></div>
            <div class="cce-legend" id="cce-sinks-leg"></div><figcaption class="cce-src" id="cce-sinks-cap"></figcaption>
          </figure>
        </div></div>
      </section>
      <section class="cce-drivers" aria-labelledby="cce-drivers-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-drivers-h">What warms, what cools</h2>
          <div class="cce-prose" id="cce-drv-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig"><div class="cce-bars" id="cce-drv"></div><figcaption class="cce-src" id="cce-drv-cap"></figcaption></figure>
        </div></div>
        <div class="block"><div class="block__rail">
          <h3>Which gases, which sectors</h3>
          <div class="cce-prose" id="cce-gas-text"></div>
        </div><div class="block__body">
          <div class="cce-pair">
            <figure class="cce-fig"><p class="cce-fig__t" id="cce-gas-t"></p><div class="cce-bars" id="cce-gas"></div><figcaption class="cce-src" id="cce-gas-cap"></figcaption></figure>
            <figure class="cce-fig"><p class="cce-fig__t" id="cce-sec-t"></p><div class="cce-bars" id="cce-sec"></div><figcaption class="cce-src" id="cce-sec-cap"></figcaption></figure>
          </div>
        </div></div>
      </section>
      <section class="cce-countries" aria-labelledby="cce-countries-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-countries-h">Which countries</h2>
          <div class="cce-prose" id="cce-cty-text"></div>
        </div><div class="block__body">
          <div class="cce-tabs" id="cce-cty-tabs" role="group" aria-label="Measure"></div>
          <div class="cce-tools"><label class="cce-pick" for="cce-cty-pick"><span>Find a country</span><select id="cce-cty-pick"></select></label></div>
          <figure class="cce-fig"><div class="cce-bars" id="cce-cty"></div><figcaption class="cce-src" id="cce-cty-cap"></figcaption></figure>
        </div></div>
      </section>
      <section class="cce-impacts" aria-labelledby="cce-impacts-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-impacts-h">How it shows up</h2>
          <div class="cce-prose" id="cce-ext-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig"><div class="cce-ext" id="cce-ext"></div><figcaption class="cce-src" id="cce-ext-cap"></figcaption></figure>
        </div></div>
        <div class="block"><div class="block__rail">
          <h3>Already measured</h3>
          <div class="cce-prose" id="cce-obs-text"></div>
        </div><div class="block__body">
          <div class="cce-cards" id="cce-cards"></div>
        </div></div>
      </section>
      <section class="cce-life" aria-labelledby="cce-life-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-life-h">Your lifetime</h2>
          <div class="cce-prose" id="cce-life-text" aria-live="polite"></div>
        </div><div class="block__body">
          <form class="cce-life__form" id="cce-life-form" onsubmit="return false">
            <div class="cce-tools"><label class="cce-find cce-find--year" for="cce-born"><span>Year you were born</span>
              <input id="cce-born" type="number" inputmode="numeric" min="1930" max="2025" step="1" value="1990"></label></div>
            <span class="note" id="cce-born-msg" aria-live="polite"></span>
          </form>
          <figure class="cce-fig">
            <div class="cce-stripes" id="cce-stripes"></div>
            <div class="cce-legend" id="cce-stripes-leg"></div>
            <figcaption class="cce-src" id="cce-stripes-cap"></figcaption>
          </figure>
        </div></div>
      </section>
      <section class="cce-local" aria-labelledby="cce-local-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-local-h">Where you live</h2>
          <div class="cce-prose" id="cce-local-text" aria-live="polite"></div>
        </div><div class="block__body">
          <form class="cce-life__form" onsubmit="return false">
            <div class="cce-tools"><label class="cce-pick" for="cce-country"><span>Country</span><select id="cce-country"></select></label></div>
          </form>
          <figure class="cce-fig">
            <div class="cce-mini cce-mini--tall" id="cce-local-chart"></div>
            <div class="cce-legend" id="cce-local-leg"></div>
            <figcaption class="cce-src" id="cce-local-cap"></figcaption>
          </figure>
        </div></div>
      </section>
      ${places ? `<section class="cce-places" aria-labelledby="cce-places-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-places-h">${places.length} places, then, now and at more warming</h2>
          <div class="cce-prose" id="cce-places-text"></div>
        </div><div class="block__body">
          <div class="cce-place-pick" id="cce-place-pick" role="group" aria-label="Choose a place"></div>
          <article class="cce-card" id="cce-card" aria-live="polite"></article>
          <p class="cce-src" id="cce-places-cap"></p>
        </div></div>
      </section>` : ''}
      <section class="cce-decide" aria-labelledby="cce-decide-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-decide-h">What decides it</h2>
          <div class="cce-prose" id="cce-budget-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig">
            <h3>CO₂ emitted so far, and what is left</h3>
            <div class="cce-bars" id="cce-budget"></div>
            <figcaption class="cce-src" id="cce-budget-cap"></figcaption>
          </figure>
        </div></div>
        <div class="block"><div class="block__rail">
          <div class="cce-prose" id="cce-cuts-text"></div>
        </div><div class="block__body">
          <figure class="cce-fig">
            <h3>How fast emissions fall in pathways that hold warming</h3>
            <div class="cce-bars" id="cce-cuts"></div>
            <figcaption class="cce-src" id="cce-cuts-cap"></figcaption>
          </figure>
        </div></div>
      </section>
      <section class="cce-method" aria-labelledby="cce-method-h">
        <a class="cce-top" href="#cce-nav">↑ Top</a>
        <div class="block"><div class="block__rail">
          <h2 id="cce-method-h">Sources and method</h2>
        </div><div class="block__body">
          <div class="cce-method__body"></div>
        </div></div>
      </section>`;

    // ---------- figures used in the text ----------
    const g10 = mean('obs_global', lastObs - 9, lastObs), l10 = mean('obs_land', lastObs - 9, lastObs), s10 = mean('obs_sea', lastObs - 9, lastObs);
    const yrs10 = `${lastObs - 9}–${lastObs}`;
    const lgm = pts('lgmr').reduce((m, r) => (r.v < m.v ? r : m), { v: Infinity });
    const holoStart = (landmarks.find((l) => l.id === 'holocene') || {}).year_start ?? -9700;
    const holo = pts('temp12k').filter((r) => r.y >= -8000);
    const holoRange = d3.max(holo, (r) => r.v) - d3.min(holo, (r) => r.v);
    const p2k = pts('pages2k');
    const p2kRange = d3.max(p2k, (r) => r.v) - d3.min(p2k, (r) => r.v);
    const pastMax = d3.max([...pts('lgmr'), ...pts('temp12k'), ...p2k], (r) => r.v);
    const lgmrPts = pts('lgmr'), preInd = lgmrPts[lgmrPts.length - 1];
    const warmTotal = preInd.v - lgm.v, warmYears = preInd.y - lgm.y;
    const rateDeglac = d3.max(lgmrPts, (r) => { const q = near('lgmr', r.y + 1000); return q && q.y > r.y ? (q.v - r.v) / (q.y - r.y) * 100 : null; });
    const atHolo = near('lgmr', holoStart);
    const trend = (() => {   // least-squares trend of the global mean over the last 50 years, °C per century
      const a = pts('obs_global').filter((r) => r.y > lastObs - 50);
      const mx = d3.mean(a, (r) => r.y), my = d3.mean(a, (r) => r.v);
      return d3.sum(a, (r) => (r.y - mx) * (r.v - my)) / d3.sum(a, (r) => (r.y - mx) ** 2) * 100;
    })();
    const hottest = (sid) => pts(sid).reduce((m, r) => (r.v > m.v ? r : m), { v: -Infinity });
    const agoYears = (y) => Math.round((NOW - y) / 100) * 100;
    const pEnd = (sid) => ({ v: mean(sid, 2081, 2099), lo: mean(sid, 2081, 2099, 'lo'), hi: mean(sid, 2081, 2099, 'hi') });

    // ---------- lead ----------
    const lead = root.querySelector('.cce-lead');
    lead.querySelector('#cce-hero-now-l').textContent = `Measured, ${yrs10}`;
    lead.querySelector('#cce-hero-now').innerHTML = `${sgn(g10)}<small> °C</small>`;
    lead.querySelector('#cce-hero-now-text').innerHTML = `Earth’s surface, on average over the last ten years, compared with 1850–1900.
      Over land it was <strong>${sgn(l10)} °C</strong>, at the sea surface <strong>${sgn(s10)} °C</strong>.
      <span class="cce-src">(${src('obs_global', 'HadCRUT5')}; ${src('obs_land', 'Berkeley Earth')}, a preliminary release, not yet peer reviewed, so values may change; ${src('obs_sea', 'HadSST4')})</span>`;
    function drawLead() {
      const sc = SC.get(cur), p = per(sc.code, '2081-2100'), sp = split(p.best_c);
      lead.querySelector('#cce-hero-2100').innerHTML = `${sgn(p.best_c)}<small> °C</small>`;
      lead.querySelector('#cce-hero-2100-text').innerHTML = `with ${esc(sc.label.toLowerCase())}, very likely
        ${fmt(p.low_c, 1)} to ${fmt(p.high_c, 1)} °C. Over land about <strong>${sgn(sp.land)} °C</strong>, at the sea surface about
        <strong>${sgn(sp.sea)} °C</strong>.<span class="cce-src"> (<a href="${esc(p.source_url)}">IPCC AR6, Table SPM.1</a>; land and sea: our split, see method)</span>`;
      lead.querySelector('.cce-lead__scen').innerHTML = `<strong>${esc(sc.label)} (${esc(sc.code)}):</strong> ${esc(sc.emissions)}
        These are paths that depend on what the world does, not forecasts: the IPCC does not say which is most likely.`;
    }

    // ---------- scenario tabs (lead and chart stay in step) ----------
    const tabGroups = [...root.querySelectorAll('.cce-tabs[aria-label="Emissions scenario"]')];
    tabGroups.forEach((g) => SSPS.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.s = s; b.innerHTML = esc(SC.get(s).label).replace(' emissions', '<span class="cce-tab-x">&nbsp;emissions</span>');
      b.addEventListener('click', () => setScenario(s));
      g.appendChild(b);
    }));
    function setScenario(s) {
      cur = s;
      tabGroups.forEach((g) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === cur))));
      drawLead(); chart.redraw(); stepTexts(); drawExt(); drawLife(); if (cardHook) cardHook();
    }

    // ---------- the steps ----------
    const L = (s) => SC.get(s).label.toLowerCase();
    const STEPS = [
      { x: [-22050, 2100], y: [-8, 3], rank: 1, past: ['lgmr'], obs: true,
        alt: () => `Chart: global temperature over the last 24,000 years, about ${fmt(-lgm.v, 0)} °C colder than 1850–1900 at the height of the ice age.`,
        html: () => `<p><strong>Where we come from.</strong> About ${fmt(agoYears(lgm.y))} years ago, near the end of the last
          ice age, Earth’s surface was about <strong>${fmt(-lgm.v, 1)} °C colder</strong> than in 1850–1900, shortly after
          the ice sheets had reached their largest extent.</p>
          <p>Then the ice age ended. By the start of the Holocene, ${fmt(2000 - holoStart)} years ago, the world had
          warmed by about ${fmt(atHolo.v - lgm.v, 0)} °C; by the time of the first thermometers, by about ${fmt(warmTotal, 0)} °C in all,
          over some ${fmt(Math.round(warmYears / 1000))},000 years. <span class="cce-src">(${src('lgmr')}, 5–95% range shaded)</span></p>` },
      { x: [-10500, 2100], y: [-2.5, 2.5], rank: 1, past: ['temp12k'], obs: true,
        alt: () => `Chart: the Holocene, global temperature within about ${fmt(holoRange, 1)} °C for 10,000 years.`,
        html: () => `<p><strong>A stable climate.</strong> For the last 10,000 years, the Holocene, global temperature stayed
          within about <strong>${fmt(holoRange, 1)} °C</strong> (central estimate). Farming began early in the Holocene, as the climate
          settled after the ice age, and people later built the first cities.</p><p>Proxy records and climate models differ on
          the details: the records show a warm peak about 6,000 years ago, the models steady warming. <span class="cce-src">(${src('temp12k')}, 5–95% range shaded)</span></p>` },
      { x: [1, 2100], y: [-1, 2.5], rank: 2, past: ['pages2k'], obs: true,
        alt: () => `Chart: the last 2,000 years; global temperature moved within about ${fmt(p2kRange, 1)} °C until 1850, then rose.`,
        html: () => `<p><strong>The last 2,000 years.</strong> Until industrialisation, global temperature moved within
          about <strong>${fmt(p2kRange, 1)} °C</strong> (31-year averages). Cold and warm spells such as the Little Ice Age were
          regional and did not happen everywhere at the same time.</p>
          <p>The thermometer record starts in 1850. Then the line leaves this band. <span class="cce-src">(${src('pages2k')})</span></p>` },
      { x: [1850, 2026], y: [-0.8, 2.5], rank: 3, obs: true, bands: true,
        alt: () => `Chart: measured warming since 1850, land ${sgn(l10)} °C and sea surface ${sgn(s10)} °C in ${yrs10}.`,
        html: () => { const hl = hottest('obs_land'), hs = hottest('obs_sea');
          return `<p><strong>Measured since 1850.</strong> Land and sea surface have warmed, land faster: over ${yrs10}
          land was on average <strong>${sgn(l10)} °C</strong> warmer than in 1850–1900, the sea surface <strong>${sgn(s10)} °C</strong>.
          The warmest year so far on land was ${hl.y} (${sgn(hl.v)} °C), at sea ${hs.y} (${sgn(hs.v)} °C).</p>
          <p>The lines mark when scientists described the greenhouse effect, and when oil companies’ own experts
          briefed them on it. <span class="cce-src">(${src('obs_land', 'Berkeley Earth')}, preliminary release, values may change; ${src('obs_sea', 'HadSST4')}; 95% uncertainty shaded)</span></p>`; } },
      { x: [1850, 2100], y: [-0.8, 8.5], rank: 2, obs: true, proj: ['land', 'sea'], tabs: true,
        alt: () => { const l = pEnd(`proj_land_${cur}`), s = pEnd(`proj_sea_${cur}`);
          return `Chart: measured warming and projections to 2100 with ${L(cur)}: land about ${sgn(l.v)} °C, sea surface ${sgn(s.v)} °C by 2081–2099.`; },
        html: () => { const l = pEnd(`proj_land_${cur}`), s = pEnd(`proj_sea_${cur}`);
          const others = SSPS.filter((x) => x !== cur).map((x) => `${L(x)} ${sgn(pEnd(`proj_land_${x}`).v)} °C`).join(', ');
          return `<p><strong>Where we are heading.</strong> With <span class="cce-cur">${esc(L(cur))}</span>, land would be about
          <strong>${sgn(l.v)} °C</strong> warmer than in 1850–1900 by 2081–2099 (range ${fmt(l.lo, 1)} to ${fmt(l.hi, 1)} °C, our estimate, see method),
          the sea surface about <strong>${sgn(s.v)} °C</strong> (${fmt(s.lo, 1)} to ${fmt(s.hi, 1)} °C). The chart’s projections end in 2099;
          the figures at the top of the page are the IPCC’s for 2081–2100, so they can differ by a tenth of a degree.</p>
          <p>The thin lines show the other paths for land: ${others}. Switch the path above the chart. Which path the world
          takes depends on its emissions; the IPCC gives no odds. <span class="cce-src">(IPCC global projection, ${src(`proj_global_${cur}`, 'SPM.8')};
          land and sea split with the IPCC’s land/ocean ratio, see method)</span></p>`; } },
      { x: [-22050, 2100], y: [-8, 6], rank: 1, past: ['lgmr'], obsGlobal: true, proj: ['global'], tabs: true, thr: true,
        alt: () => `Chart: the whole span. Projected global warming by 2100 compared with the change since the ice age.`,
        html: () => { const g = pEnd(`proj_global_${cur}`);
          return `<p><strong>Zoom out.</strong> Leaving the ice age, the fastest warming over any 1,000 years in this
          reconstruction was about ${fmt(rateDeglac, 2)} °C per century. Over the last 50 years the world warmed by about
          <strong>${fmt(trend, 1)} °C per century</strong>, more than ${fmt(Math.floor(trend / rateDeglac / 5) * 5)} times as fast.
          (The reconstruction averages over 200 years, so short bursts in the past may have been faster than it shows.)</p>
          <p>With ${esc(L(cur))}, the global mean would reach about <strong>${sgn(g.v)} °C</strong> by 2081–2099${g.v > pastMax
            ? `, warmer than at any time in the ${fmt(Math.round((NOW + 22050) / 1000) * 1000)} years shown here` : ''}. Global, here, because the
          Paris limits of 1.5 °C and 2 °C refer to the global mean. <span class="cce-src">(${src('obs_global', 'HadCRUT5')}; ${src(`proj_global_${cur}`, 'IPCC SPM.8')})</span></p>`; } },
    ];
    const stepsEl = root.querySelector('.story__steps');
    stepsEl.innerHTML = STEPS.map((s, i) => `<div class="step" data-i="${i}"><div class="step__text"></div></div>`).join('');
    function stepTexts() { stepsEl.querySelectorAll('.step__text').forEach((el, i) => { el.innerHTML = STEPS[i].html(); }); }

    // ---------- landmarks: fixed numbers (chronological) shared by the chart and the list below it (review D1, F1) ----------
    const KIND = { nature: 'Nature', history: 'History', policy: 'Policy', science: 'Science', industry: 'Industry' };
    const lmSorted = landmarks.slice().sort((a, b) => a.year_start - b.year_start || a.rank - b.rank);
    const NUM = new Map(lmSorted.map((l, i) => [l.id, i + 1]));
    {
      const det = root.querySelector('#cce-lm-all');
      det.querySelector('summary').textContent = `All ${lmSorted.length} landmarks, with notes and sources`;
      det.querySelector('table').innerHTML = `<thead><tr><th scope="col">No.</th><th scope="col">When</th><th scope="col">Kind</th>
        <th scope="col">Landmark</th><th scope="col">Source</th></tr></thead><tbody>${lmSorted.map((l) => `<tr data-lm="${esc(l.id)}"><td>${NUM.get(l.id)}</td>
        <td>${esc(l.date_label)}</td><td>${esc(KIND[l.kind])}</td><td><b>${esc(l.label)}</b> ${esc(l.note || '')}</td>
        <td><a href="${esc(l.source_url)}">Source</a></td></tr>`).join('')}</tbody>`;
    }

    // ---------- the chart ----------
    const chart = timelineChart(root.querySelector('#cce-chart'));
    function timelineChart(host) {
      // role group, not img: the landmark buttons inside must stay reachable for screen readers (review F1)
      const svg = d3.select(host).append('svg').attr('role', 'group');
      const descs = d3.select(host).append('div').attr('class', 'cce-sr');
      descs.selectAll('span').data(landmarks).join('span').attr('id', (l) => `cce-lmd-${l.id}`)
        .text((l) => `${KIND[l.kind]}. ${l.note || ''} Number ${NUM.get(l.id)} in the list of landmarks below the chart.`);
      const gFuture = svg.append('rect').attr('class', 'cce-future');
      const gLm = svg.append('g'), gThr = svg.append('g').attr('class', 'cce-thr');
      const gBands = svg.append('g'), gLines = svg.append('g'), gNow = svg.append('g').attr('class', 'cce-now');
      const gEnd = svg.append('g');
      const gx = svg.append('g').attr('class', 'cce-axis'), gy = svg.append('g').attr('class', 'cce-axis');
      const zero = svg.append('line').attr('class', 'cce-zero');
      const tip = d3.select(host).append('div').attr('class', 'cce-tip').attr('hidden', true);
      const x = d3.scaleLinear(), y = d3.scaleLinear();
      const kinds = new Set(['nature', 'history', 'policy', 'science', 'industry']);
      let step = STEPS[0], W = 0, H = 0, M = {}, anim = null, narrow = false, started = false;

      function size() {
        W = host.clientWidth; H = host.clientHeight; narrow = W < 560;
        M = { t: narrow ? 50 : 66, r: narrow ? 74 : 112, b: 26, l: narrow ? 30 : 40 };
        svg.attr('viewBox', `0 0 ${W} ${H}`);
        x.range([M.l, W - M.r]); y.range([H - M.b, M.t]);
      }
      const line = (k) => d3.line().defined((r) => r[k] != null).x((r) => x(r.y)).y((r) => y(r[k]));
      const area = d3.area().x((r) => x(r.y)).y0((r) => y(r.lo)).y1((r) => y(r.hi));
      const inX = (a) => { const [x0, x1] = x.domain(), pad = (x1 - x0) * 0.02; return a.filter((r) => r.y >= x0 - pad && r.y <= x1 + pad); };

      function layers() {
        const L = [];
        (step.past || []).forEach((sid) => L.push({ sid, cls: 'past', band: true }));
        if (step.obs) { L.push({ sid: 'obs_land', cls: 'land', band: !!step.bands, end: 'Land' }); L.push({ sid: 'obs_sea', cls: 'sea', band: !!step.bands, end: 'Sea surface' }); }
        if (step.obsGlobal) L.push({ sid: 'obs_global', cls: 'glob', end: step.proj ? null : 'Global' });
        (step.proj || []).forEach((k) => {
          SSPS.filter((s) => s !== cur).forEach((s) => { if (k !== 'sea') L.push({ sid: `proj_${k}_${s}`, cls: k === 'global' ? 'glob' : k, alt: true, end: `${k === 'global' ? '' : 'Land, '}${SC.get(s).label.replace(' emissions', '').toLowerCase()}` }); });
          L.push({ sid: `proj_${k}_${cur}`, cls: k === 'global' ? 'glob' : k, band: true, proj: true, end: k === 'global' ? 'Global' : k === 'land' ? 'Land' : 'Sea surface' });
        });
        return L;
      }
      function axes() {
        const [x0, x1] = x.domain(), span = x1 - x0;
        let ticks, label;
        if (span > 3000) {
          const a = d3.ticks(Math.max(0, NOW - x1), NOW - x0, narrow ? 4 : 6).filter((t) => t > 0);
          ticks = a.map((t) => NOW - t);
          label = (v) => (narrow ? `${fmt((NOW - v) / 1000)}k yrs ago` : `${fmt(NOW - v)} years ago`);
        } else {
          ticks = d3.ticks(x0, x1, narrow ? 4 : 8).filter((t) => t > 0 && t <= 2100);
          label = (v) => String(v);
        }
        gx.attr('transform', `translate(0,${H - M.b})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat(label).tickSizeOuter(0));
        gy.attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(narrow ? 5 : 7).tickFormat((v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')).tickSizeOuter(0));
        gy.select('.domain').remove();
        zero.attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(0)).attr('y2', y(0));
      }
      function draw() {
        axes();
        const [x0, x1] = x.domain();
        gFuture.attr('x', x(Math.max(x0, lastObs))).attr('y', M.t).attr('width', Math.max(0, x(x1) - x(Math.max(x0, lastObs)))).attr('height', H - M.b - M.t)
          .attr('opacity', x1 > lastObs + 5 ? null : 0);
        const L = layers();
        gBands.selectAll('path').data(L.filter((l) => l.band), (l) => l.sid).join('path')
          .attr('class', (l) => `cce-band cce-band--${l.cls}`).attr('d', (l) => area(inX(pts(l.sid))));
        gLines.selectAll('path').data(L, (l) => l.sid).join('path')
          .attr('class', (l) => `cce-line cce-line--${l.cls}${l.proj ? ' cce-line--proj' : ''}${l.alt ? ' cce-line--alt' : ''}`)
          .attr('d', (l) => line('v')(inX(pts(l.sid))));
        // labels at the right end of each line, pushed apart
        const ends = L.filter((l) => l.end).map((l) => { const a = inX(pts(l.sid)); const r = a[a.length - 1];
          return r && { l, r, yy: y(r.v), t: l.end }; }).filter(Boolean).sort((a, b) => a.yy - b.yy);   // names only: figures are in the text
        for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 12) ends[i].yy = ends[i - 1].yy + 12;
        gEnd.selectAll('text').data(ends, (e) => e.l.sid).join('text')
          .attr('class', (e) => `cce-endlab cce-endlab--${e.l.alt ? 'alt' : e.l.cls}`)
          .attr('x', (e) => x(e.r.y) + 5).attr('y', (e) => e.yy + 4).text((e) => (narrow ? e.t.replace('Sea surface', 'Sea').replace('Land, ', '') : e.t));
        // today
        const showNow = x1 > lastObs + 5 && step.proj;
        gNow.selectAll('*').remove();
        if (showNow) {
          gNow.append('line').attr('x1', x(lastObs)).attr('x2', x(lastObs)).attr('y1', M.t).attr('y2', H - M.b);
          gNow.append('text').attr('x', x(lastObs) - 4).attr('y', H - M.b - 6).attr('text-anchor', 'end').text(`${lastObs}`);
        }
        // Paris limits (global mean)
        gThr.selectAll('*').remove();
        if (step.thr) [1.5, 2].forEach((t) => {
          gThr.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(t)).attr('y2', y(t));
          gThr.append('text').attr('x', M.l + 4).attr('y', y(t) - 3).text(`${t} °C${t === 2 ? ': Paris, well below 2 °C (global mean)' : t === 1.5 ? ': Paris, efforts to limit to 1.5 °C' : ''}`);
        });
        landmarksDraw();
      }
      // label widths measured, not guessed (review D1); cached per text
      const meas = svg.append('g').attr('class', 'cce-lm').attr('aria-hidden', 'true').style('visibility', 'hidden').append('text');
      const wCache = new Map();
      const tw = (s) => { if (!wCache.has(s)) wCache.set(s, meas.text(s).node().getComputedTextLength() + 8); return wCache.get(s); };
      function landmarksDraw() {
        const [x0, x1] = x.domain();
        const rows = narrow ? 3 : 4, rowH = 15, top = 10;
        const cand = landmarks.filter((l) => kinds.has(l.kind) && l.rank <= step.rank && l.year_start <= x1 && (l.year_end ?? l.year_start) >= x0)
          .sort((a, b) => a.rank - b.rank || a.year_start - b.year_start);
        const occ = Array.from({ length: rows }, () => []), placed = new Map();
        // first the full labels by rank; lines left without one get their number from the list below the chart
        const place = (l, text) => {
          const px = x(Math.max(l.year_start, x0)), w = tw(text);
          let start = px + 3, anchor = 'start';
          if (start + w > W - 4) { start = Math.max(2, px - 3 - w); anchor = start === 2 ? 'clamp' : 'end'; }
          for (let r = 0; r < rows; r++) {
            if (occ[r].every(([a, b]) => start + w < a || start > b)) { occ[r].push([start, start + w]); placed.set(l.id, { r, anchor, px, text }); return true; }
          }
          return false;
        };
        const left = cand.filter((l) => !place(l, l.label));
        left.forEach((l) => place(l, String(NUM.get(l.id))));
        const g = gLm.selectAll('g.cce-lm').data(cand, (l) => l.id).join((en) => {
          const e = en.append('g').attr('class', 'cce-lm').attr('tabindex', 0).attr('role', 'button');
          // first rect = the period's span; the yellow band and label box light up on hover (cce.css)
          e.append('rect'); e.append('line').attr('class', 'cce-lm-hl'); e.append('rect').attr('class', 'cce-lm-tb');
          e.append('line').attr('class', 'cce-lm-v'); e.append('line').attr('class', 'cce-lm-hit'); e.append('text');
          // keyboard: focus shows the note; Enter or Space keeps it open and moves to its Source link; Escape closes (review F1, F2)
          // the landmark's row in the list below the chart lights up with it (and the other way round, see below)
          e.on('mouseenter.row focus.row', (ev, l) => rowHl(l.id, true)).on('mouseleave.row blur.row', (ev, l) => rowHl(l.id, false));
          e.on('mouseenter', (ev, l) => show(l, ev)).on('mouseleave', () => hide(false)).on('click', (ev, l) => { ev.stopPropagation(); show(l, ev, true); })
            .on('focus', (ev, l) => show(l, ev)).on('blur', blurred)
            .on('keydown', function (ev, l) {
              if (ev.key === 'Escape') hide(true);
              if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); show(l, ev, true); back = this; tip.select('a').node().focus(); }
            });
          return e;
        });
        g.attr('data-kind', (l) => l.kind).attr('aria-label', (l) => `${l.date_label}: ${l.label}`)
          .attr('aria-describedby', (l) => `cce-lmd-${l.id}`);
        g.each(function (l) {
          const p = placed.get(l.id), sel = d3.select(this);
          const px = x(Math.max(l.year_start, x0)), ly = p ? top + p.r * rowH + rowH : M.t;
          const span = l.year_end != null && x(l.year_end) - x(l.year_start) > 2;
          sel.select('rect').attr('x', px).attr('y', M.t).attr('height', H - M.b - M.t)
            .attr('width', span && p ? Math.max(0, x(Math.min(l.year_end, x1)) - px) : 0);
          sel.selectAll('line').attr('x1', px).attr('x2', px).attr('y1', p ? ly - rowH + 3 : M.t - 8).attr('y2', p ? H - M.b : M.t + 2);
          sel.select('text').attr('x', p ? (p.anchor === 'start' ? px + 3 : p.anchor === 'clamp' ? 2 : px - 3) : px).attr('y', ly - 3)
            .attr('text-anchor', p && p.anchor === 'end' ? 'end' : 'start')
            .classed('cce-lm-num', !!p && p.text !== l.label)
            .text(p ? p.text : '');
          const bb = p ? sel.select('text').node().getBBox() : null;
          sel.select('rect.cce-lm-tb').attr('x', bb ? bb.x - 2 : 0).attr('y', bb ? bb.y - 1 : 0)
            .attr('width', bb ? bb.width + 4 : 0).attr('height', bb ? bb.height + 2 : 0);
          // the band under the line starts at the top of the label box, so band and box join without a gap
          if (bb) sel.select('line.cce-lm-hl').attr('y1', Math.min(+sel.select('line.cce-lm-hl').attr('y1'), bb.y - 1));
        });
      }
      const rowHl = (id, on) => { const r = root.querySelector(`#cce-lm-all tr[data-lm="${CSS.escape(id)}"]`); if (r) r.classList.toggle('is-hl', on); };
      root.querySelectorAll('#cce-lm-all tr[data-lm]').forEach((r) => {
        const lm = () => gLm.selectAll('g.cce-lm').filter((l) => l.id === r.dataset.lm);
        r.addEventListener('mouseenter', () => { r.classList.add('is-hl'); lm().classed('is-hl', true); });
        r.addEventListener('mouseleave', () => { r.classList.remove('is-hl'); lm().classed('is-hl', false); });
      });
      let pinned = false, back = null;
      // close the note only once focus has left both the line and its note, so Tab can reach the Source link
      function blurred() { setTimeout(() => { if (!tip.node().contains(document.activeElement)) hide(true); }, 0); }
      tip.on('focusout', blurred).on('keydown', (ev) => { if (ev.key === 'Escape') { hide(true); if (back) back.focus(); } });
      function show(l, ev, pin) {
        if (pinned && !pin) return;
        pinned = !!pin;
        tip.attr('hidden', null).html(`<span class="cce-note">${NUM.get(l.id)} · ${esc(l.date_label)} · ${esc(KIND[l.kind])}</span><b>${esc(l.label)}</b>
          ${l.note ? `${esc(l.note)} ` : ''}<a class="cce-src" href="${esc(l.source_url)}">Source</a>`);
        const px = x(Math.max(l.year_start, x.domain()[0])), tn = tip.node();
        const left = Math.min(Math.max(0, px - tn.offsetWidth / 2), W - tn.offsetWidth);
        tip.style('left', `${left}px`).style('top', `${M.t + 6}px`);
      }
      function hide(force) { if (pinned && !force) return; pinned = false; tip.attr('hidden', true); }
      document.addEventListener('click', (ev) => { if (!tip.node().contains(ev.target)) hide(true); });

      function go(i) {
        const target = STEPS[i], from = { x: x.domain(), y: y.domain() };
        step = target;
        root.querySelector('.cce-graphic-tabs').hidden = !target.tabs;
        svg.attr('aria-label', target.alt());
        legend();
        if (anim) anim.stop();
        if (reduced || !started) { started = true; x.domain(target.x); y.domain(target.y); draw(); return; }
        const ix = d3.interpolate(from.x, target.x), iy = d3.interpolate(from.y, target.y), ease = d3.easeCubicInOut;
        anim = d3.timer((t) => {
          const k = Math.min(1, t / 900);
          x.domain(ix(ease(k))); y.domain(iy(ease(k))); draw();
          if (k >= 1) anim.stop();
        });
      }
      function legend() {
        const items = [['', '°C compared with 1850–1900']];
        if ((step.past || []).length) items.push(['var(--ink)', 'global, reconstructed']);
        if (step.obs) items.push(['var(--red)', 'land, measured'], ['var(--blue)', 'sea surface, measured']);
        if (step.obsGlobal) items.push(['var(--ink)', 'global, measured']);
        if ((step.proj || []).length) items.push(['var(--muted)', `projected, ${L(cur)} (dashed; shaded: very likely range for the global line, our estimate for land and sea; dotted: other paths)`]);
        root.querySelector('.cce-legend').innerHTML = items.map(([c, t]) => `<span>${c ? `<i style="border-color:${c}"></i>` : ''}${esc(t)}</span>`).join('');
      }
      const kindsEl = root.querySelector('.cce-kinds');
      kindsEl.innerHTML = Object.entries(KIND).map(([k, t]) => `<label><input type="checkbox" checked value="${k}">
        <svg class="cce-lm" data-kind="${k}" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4"/></svg>${t}</label>`).join('');
      kindsEl.addEventListener('change', (ev) => { const k = ev.target.value; ev.target.checked ? kinds.add(k) : kinds.delete(k); draw(); });
      size(); x.domain(STEPS[0].x); y.domain(STEPS[0].y);
      new ResizeObserver(() => { size(); draw(); }).observe(host);
      return { go, redraw: () => { legend(); svg.attr('aria-label', step.alt()); draw(); } };
    }


    // ================= Why it warms; what warms, what cools =================
    const DS = new Map(datasets.map((d) => [d.dataset_id, d]));
    const dsrc = (id, text) => { const d = DS.get(id); return d ? `<a href="${esc(d.source_url)}">${esc(text || d.source)}</a>` : ''; };
    const pct = (a, b) => (a / b) * 100;
    // live figures carry the date they were last checked against their source (review E2)
    const asOf = (row) => { if (!row.as_of) return '';
      const [yy, mm, dd] = String(row.as_of).slice(0, 10).split('-').map(Number);
      return `, as of ${dd} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mm - 1]} ${yy}`; };
    // The numbers behind a chart as a table, collapsed under the figure (review F4): for keyboard and screen-reader users
    // and anyone who wants the values. head = column names, rows = arrays of cell text. Re-rendered on change.
    function dataTable(fig, summary, head, rows) {
      let det = fig.querySelector(':scope > details.cce-data');
      if (!det) { det = document.createElement('details'); det.className = 'cce-data'; fig.append(det); }
      const open = det.open;
      det.innerHTML = `<summary>${esc(summary)}</summary><div class="cce-data__scroll" tabindex="0" role="region" aria-label="${esc(summary)}"><table>
        <thead><tr>${head.map((h, i) => `<th scope="col"${i ? '' : ' class="l"'}>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
      det.open = open;
    }
    const NAMES = { USA: 'United States' };
    const cname = (c) => NAMES[c.name] || c.name;
    // "the United States", "the Netherlands": names that take an article in running text
    const THE = /^(United |Republic|Democratic|Dominican|Central African|Netherlands|Philippines|Bahamas|Gambia|Maldives|Solomon|Marshall|Comoros|Seychelles|Russian Federation)/;
    const theName = (n, cap) => (THE.test(n) ? `${cap ? 'The' : 'the'} ${n}` : n);
    // one naming list for both country charts (review B10): the emissions file's names by ISO3, Natural Earth's only where it has none
    const CNAME = new Map(countries.map((c) => [c.iso3, cname(c)]));

    // a small tooltip shared by the static charts
    function tipFor(host) {
      const t = d3.select(host).style('position', 'relative').append('div').attr('class', 'cce-tip').attr('hidden', true);
      return {
        show(html, px, py) {
          t.attr('hidden', null).html(html);
          // never under the pointer: right of it if there is room, else left; above it if there is room, else below
          const n = t.node(), W = host.clientWidth, w = n.offsetWidth, h = n.offsetHeight;
          const left = px + 14 + w <= W ? px + 14 : Math.max(0, px - 14 - w);
          const top = py - h - 10 >= 0 ? py - h - 10 : py + 16;
          t.style('left', `${left}px`).style('top', `${top}px`);
        },
        hide() { t.attr('hidden', true); },
      };
    }
    // draw now and on every resize
    const onSize = (host, draw) => { draw(); new ResizeObserver(() => draw()).observe(host); themeHooks.push(draw); };

    // ---------- the greenhouse effect (a diagram, no figures) ----------
    root.querySelector('#cce-ghe-text').innerHTML = `<p>Sunlight passes through the air and warms Earth’s surface. The warm
      surface gives off heat as infrared radiation. Some gases in the air (water vapour, carbon dioxide, methane, nitrous
      oxide and others) absorb part of that heat and send some of it back down. This natural greenhouse effect is why Earth is
      warm enough for life.</p>
      <p>Adding more of these gases lets less heat escape to space. The surface and air warm until as much heat escapes to
      space as sunlight comes in. Scientists described this in the 19th century, as the timeline above shows.</p>`;
    // Animated: one "energy dot" travels the path of the energy and changes colour with its form (sunlight yellow,
    // infrared heat red). Each info point appears when the dot reaches it and stays. Plays once when scrolled into view;
    // "Play again" restarts; with reduced motion the finished diagram is shown at once and the button plays it on request.
    const GHE = {
      steps: [   // id, short label (two lines), list text
        ['reflect', ['Clouds and ice reflect', 'some sunlight back to space'], 'Clouds, ice and particles reflect some sunlight straight back to space.'],
        ['sun', ['Sunlight passes', 'through the air'], 'Sunlight passes through the air.'],
        ['ground', ['The ground absorbs it and', 'gives off heat (infrared)'], 'The ground absorbs it, warms and gives off heat as infrared radiation.'],
        ['back', ['Greenhouse gases absorb heat', 'and send part of it back down'], 'Greenhouse gases absorb part of that heat and send some of it back down.'],
        ['escape', ['Part of the heat', 'escapes to space'], 'Part of the heat escapes to space.'],
        ['more', ['More greenhouse gases: the ground', 'warms until enough heat escapes'], 'With more greenhouse gases, more heat is sent back; the ground warms until enough heat escapes again.'],
      ],
      lab: { reflect: [214, 34], sun: [104, 156], ground: [40, 262], back: [306, 100], escape: [482, 36], more: [350, 262] },
      mol: [[300, 140], [235, 174], [372, 176], [520, 150], [585, 108], [455, 182]],
      molMore: [[165, 182], [330, 192], [420, 142], [488, 140], [560, 186], [612, 150], [215, 118], [272, 154]],
      route: {
        reflect: 'M58 56 L150 98 L206 2',
        sun: 'M52 62 L100 228',
        back: 'M100 228 C 140 170, 250 150, 300 140 C 345 150, 390 190, 402 228',
        escape: 'M402 228 C 420 170, 440 120, 470 0',
        more1: 'M300 228 C 300 200, 285 196, 272 154 C 262 180, 236 206, 226 228',
        more2: 'M520 228 C 515 190, 500 160, 488 140 C 475 165, 455 200, 440 228',
        more3: 'M590 228 C 600 160, 610 80, 620 0',
      },
    };
    const ghe = root.querySelector('#cce-ghe');
    ghe.innerHTML = `
      <svg viewBox="0 0 640 300" role="img" aria-labelledby="cce-ghe-title">
        <title id="cce-ghe-title">Animated diagram of the greenhouse effect: ${GHE.steps.map((s) => s[2]).join(' ')}</title>
        <rect class="cce-ghe-air" x="0" y="64" width="640" height="144"/>
        <rect class="cce-ghe-ground" id="cce-ghe-ground" x="0" y="228" width="640" height="72"/>
        <text class="cce-ghe-lab cce-ghe-zone cce-ghe-muted" x="632" y="16" text-anchor="end">Space</text>
        <text class="cce-ghe-lab cce-ghe-zone cce-ghe-muted" x="632" y="80" text-anchor="end">Air with greenhouse gases</text>
        <text class="cce-ghe-lab cce-ghe-zone cce-ghe-muted" x="632" y="292" text-anchor="end">Earth’s surface</text>
        <circle class="cce-ghe-sun" cx="44" cy="44" r="18"/>
        <g class="cce-ghe-cloud" transform="translate(150,98)"><circle cx="-16" cy="4" r="11"/><circle cx="0" cy="-4" r="14"/><circle cx="16" cy="3" r="11"/><rect x="-27" y="3" width="54" height="12" rx="6"/></g>
        <g id="cce-ghe-mols"></g>
        <g id="cce-ghe-routes"></g>
        <g id="cce-ghe-dots"></g>
        <g id="cce-ghe-labs"></g>
      </svg>
      <div class="cce-ghe-bar"><button type="button" class="cce-ghe-play" id="cce-ghe-play">${reduced ? 'Play the animation' : 'Play again'}</button></div>
      <ol class="cce-ghe-list" id="cce-ghe-list">${GHE.steps.map((s) => `<li data-s="${s[0]}">${s[2]}</li>`).join('')}</ol>
      <figcaption class="cce-note">Yellow dot: sunlight. Red dot: heat (infrared). A sketch of the mechanism, not to scale; real
        energy flows are many and in all directions.</figcaption>`;
    (function gheAnim() {
      const svg = d3.select(ghe).select('svg');
      const mols = svg.select('#cce-ghe-mols'), routes = svg.select('#cce-ghe-routes'), dots = svg.select('#cce-ghe-dots'), labs = svg.select('#cce-ghe-labs');
      const ground = svg.select('#cce-ghe-ground');
      const molecule = (sel, [x, y]) => { const g = sel.append('g').attr('class', 'cce-ghe-mol').attr('transform', `translate(${x},${y})`);
        g.append('circle').attr('cx', -7).attr('r', 3.5); g.append('circle').attr('cx', 7).attr('r', 3.5); g.append('circle').attr('class', 'cce-ghe-mol-c').attr('r', 4.5); return g; };
      let run = 0;
      const SLOW = 2;   // the whole sequence at half speed: every duration and pause times SLOW
      const wait = (ms, id) => new Promise((res) => setTimeout(res, ms * SLOW)).then(() => { if (id !== run) throw new Error('stopped'); });
      function label(id, on) {
        const [x, y] = GHE.lab[id], i = GHE.steps.findIndex((s) => s[0] === id), [a, b] = GHE.steps[i][1];
        const g = labs.append('g').attr('class', 'cce-ghe-step').attr('transform', `translate(${x},${y})`).attr('opacity', 0);
        g.append('circle').attr('r', 9).attr('cy', -4);
        g.append('text').attr('class', 'cce-ghe-n').attr('text-anchor', 'middle').text(i + 1);
        g.append('text').attr('class', 'cce-ghe-lab cce-ghe-x').attr('x', 14).text(a).append('tspan').attr('x', 14).attr('dy', 14).text(b);
        g.transition().duration(on ? 0 : 400 * SLOW).attr('opacity', 1);
        ghe.querySelector(`#cce-ghe-list li[data-s="${id}"]`).classList.add('is-on');
      }
      function travel(key, c0, c1, ms, id) {   // dot along a route, leaving a faint trace; colour c0 -> c1 halfway if given
        const path = routes.append('path').attr('class', 'cce-ghe-route').attr('d', GHE.route[key]).style('stroke', `var(--${c1 || c0})`);
        const n = path.node(), L = n.getTotalLength();
        path.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L);
        const dot = dots.append('circle').attr('class', 'cce-ghe-dot').attr('r', 6).style('fill', `var(--${c0})`);
        path.transition().duration(ms * SLOW).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
        const t = dot.transition().duration(ms * SLOW).ease(d3.easeCubicInOut);
        t.attrTween('transform', () => (u) => { const q = n.getPointAtLength(u * L); return `translate(${q.x},${q.y})`; })
          .styleTween('fill', () => (u) => `var(--${c1 && u > 0.5 ? c1 : c0})`);
        return t.end().catch(() => {}).then(() => { dot.remove(); if (id !== run) throw new Error('stopped'); });
      }
      function flash(x, y) {
        const g = mols.selectAll('.cce-ghe-mol').filter(function () { const tr = this.getAttribute('transform'); return tr === `translate(${x},${y})`; });
        g.classed('is-hot', true); setTimeout(() => g.classed('is-hot', false), 700 * SLOW);
      }
      function reset() {
        run += 1;
        [routes, dots, labs].forEach((s) => { s.selectAll('*').interrupt().remove(); });
        mols.selectAll('*').remove(); GHE.mol.forEach((m) => molecule(mols, m));
        ground.classed('is-warm', false).classed('is-lit', false);
        ghe.querySelectorAll('#cce-ghe-list li').forEach((li) => li.classList.remove('is-on'));
      }
      function finished() {   // the end state, drawn without motion
        reset();
        Object.entries(GHE.route).forEach(([k, d]) => routes.append('path').attr('class', 'cce-ghe-route').attr('d', d)
          .style('stroke', `var(--${k === 'reflect' || k === 'sun' ? 'yellow' : 'red'})`));
        GHE.molMore.forEach((m) => molecule(mols, m).classed('cce-ghe-mol--new', true));
        ground.classed('is-warm', true);
        GHE.steps.forEach((s) => label(s[0], true));
      }
      async function play() {
        reset(); const id = run;
        try {
          await wait(300, id);
          await travel('reflect', 'yellow', null, 1600, id); label('reflect');
          await wait(500, id);
          await travel('sun', 'yellow', null, 1300, id); label('sun');
          await wait(300, id);
          ground.classed('is-lit', true); setTimeout(() => ground.classed('is-lit', false), 350 * SLOW);
          label('ground'); await wait(700, id);
          const back = travel('back', 'red', null, 2400, id);
          setTimeout(() => { if (id === run) flash(300, 140); }, 1200 * SLOW);
          await back; label('back');
          await wait(400, id);
          await travel('escape', 'red', null, 1500, id); label('escape');
          await wait(900, id);
          const extra = GHE.molMore.map((m) => molecule(mols, m).classed('cce-ghe-mol--new', true).attr('opacity', 0));
          extra.forEach((g, i) => g.transition().delay(i * 120 * SLOW).duration(400 * SLOW).attr('opacity', 1));
          await wait(1300, id);
          const runs = [travel('more1', 'red', null, 2000, id), travel('more2', 'red', null, 2000, id), travel('more3', 'red', null, 2200, id)];
          setTimeout(() => { if (id === run) { flash(272, 154); flash(488, 140); } }, 1000 * SLOW);
          setTimeout(() => { if (id === run) ground.classed('is-warm', true); }, 600 * SLOW);
          await Promise.all(runs); label('more');
        } catch (e) { /* stopped by a new run */ }
      }
      ghe.querySelector('#cce-ghe-play').addEventListener('click', () => play());   // with reduced motion it plays only on request (review F3)
      if (reduced || !('IntersectionObserver' in window)) { finished(); return; }
      reset();
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); play(); } }, { threshold: 0.6 });
      io.observe(svg.node());
    })();

    // ---------- CO2 over 800,000 years ----------
    const ice = co2.filter((r) => r.d === 'icecore'), mlo = co2.filter((r) => r.d === 'mlo');
    const icePre = ice.filter((r) => r.y < 1800);
    const coMin = d3.min(icePre, (r) => r.v), coMax = d3.max(icePre, (r) => r.v);
    const co1750 = d3.mean(ice.filter((r) => r.y >= 1740 && r.y <= 1760), (r) => r.v);
    const coNow = mlo[mlo.length - 1], co1959 = mlo[0];
    const coRise10 = (coNow.v - mlo.find((r) => r.y === coNow.y - 10).v) / 10;
    root.querySelector('#cce-co2-text').innerHTML = `<p>Air bubbles trapped in Antarctic ice record the CO₂ in the air for more than
      ${fmt(Math.floor((NOW - ice[0].y) / 100000) * 100000)} years. Until industrialisation, it moved between about <strong>${fmt(coMin)} and ${fmt(coMax)} ppm</strong>
      (parts per million), low in ice ages and high in the warm periods between them. Around 1750 it was about ${fmt(co1750)} ppm.</p>
      <p>Measurements at Mauna Loa, Hawaii, began in 1958. In ${coNow.y} the annual mean was <strong>${fmt(coNow.v)} ppm</strong>,
      ${fmt(pct(coNow.v - co1750, co1750))}% more than in 1750 and higher than at any point in the ice-core record. Over the last ten
      years it rose by about ${fmt(coRise10, 1)} ppm a year.</p>`;
    root.querySelector('#cce-co2-leg').innerHTML = `<span><i style="border-color:var(--ink)"></i>ice cores</span><span><i style="border-color:var(--red)"></i>measured at Mauna Loa</span><span>CO₂ in parts per million</span>`;
    root.querySelector('#cce-co2-cap').innerHTML = `${dsrc('icecore', 'Bereiter et al. 2015')}; ${dsrc('mlo', 'NOAA GML')}. Ice-core ages are gas ages; each core sample averages decades to centuries.`;
    dataTable(root.querySelector('#cce-co2-cap').closest('figure'), 'Show the data as a table (CO₂, parts per million)', ['Year', 'Source', 'CO₂, ppm'],
      co2.slice().sort((a, b) => b.y - a.y).map((r) => [r.y < 0 ? `${fmt(-r.y)} BCE` : String(r.y), r.d === 'mlo' ? 'Mauna Loa, yearly mean' : 'Antarctic ice cores', fmt(r.v, 1)]));
    function co2Chart(host, x0, x1, yd, title, ago) {
      const tip = tipFor(host);
      onSize(host, () => {
        const W = host.clientWidth, H = host.clientHeight, M = { t: 22, r: 14, b: 24, l: 36 };
        d3.select(host).select('svg').remove();
        const svg = d3.select(host).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
          .attr('aria-label', `Chart: ${title}. CO₂ ${fmt(coNow.v)} ppm in ${coNow.y}.`);
        const x = d3.scaleLinear([x0, x1], [M.l, W - M.r]), y = d3.scaleLinear(yd, [H - M.b, M.t]);
        const ticks = ago ? d3.ticks(0, NOW - x0, W < 420 ? 3 : 4).map((a) => NOW - a) : d3.ticks(x0, x1, W < 420 ? 4 : 6);
        svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(0,${H - M.b})`)
          .call(d3.axisBottom(x).tickValues(ticks).tickFormat((v) => (ago ? (NOW - v === 0 ? 'today' : `${fmt((NOW - v) / 1000)}k yrs ago`) : String(v))).tickSizeOuter(0));
        svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(5).tickSizeOuter(0)).select('.domain').remove();
        svg.append('text').attr('class', 'cce-ylabel').attr('x', M.l).attr('y', 11).text(title);
        const ln = d3.line().x((r) => x(r.y)).y((r) => y(r.v));
        const inside = (a) => a.filter((r) => r.y >= x0 && r.y <= x1);
        svg.append('path').attr('class', 'cce-line cce-line--past').attr('d', ln(inside(ice)));
        svg.append('path').attr('class', 'cce-line cce-line--land').attr('d', ln(inside(mlo)));
        svg.append('line').attr('class', 'cce-thr-l').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(coMax)).attr('y2', y(coMax));
        svg.append('text').attr('class', 'cce-thr-t').attr('x', M.l + 4).attr('y', y(coMax) - 4).text(`highest before 1800: ${fmt(coMax)}`);
        const all = inside([...ice, ...mlo]).sort((a, b) => a.y - b.y);
        const dot = svg.append('circle').attr('class', 'cce-dot').attr('r', 4).attr('opacity', 0);
        svg.append('rect').attr('class', 'cce-hover').attr('x', M.l).attr('y', M.t).attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
          .on('mousemove', (ev) => {
            const [mx] = d3.pointer(ev), yy = x.invert(mx);
            const r = all[Math.min(all.length - 1, d3.bisector((q) => q.y).center(all, yy))];
            dot.attr('cx', x(r.y)).attr('cy', y(r.v)).attr('opacity', 1);
            tip.show(`<b>${fmt(r.v)} ppm</b><span class="cce-note">${ago && r.y < 1000 ? `${fmt(NOW - r.y)} years ago` : r.y} · ${r.d === 'mlo' ? 'Mauna Loa' : 'ice core'}</span>`, x(r.y), y(r.v));
          })
          .on('mouseleave', () => { dot.attr('opacity', 0); tip.hide(); });
      });
    }
    co2Chart(root.querySelector('#cce-co2-long'), ice[0].y, NOW, [150, 450], '800,000 years', true);
    co2Chart(root.querySelector('#cce-co2-short'), 1750, NOW, [250, 450], 'Since 1750', false);


    // ================= Day by day (ERA5 daily, Copernicus Climate Pulse) =================
    // Colour = the year's average compared with 1850-1900, on the same scale as the warming stripes: the site's diverging
    // scale, 7 classes, blue (cooler) - grey - red (warmer), light and dark values from DESIGN-PRINCIPLES.md 4.3; round
    // limits at ±0.5, ±1 and ±2 °C. Lines (forLines) draw the middle class in the guide's "everything else" grey, because
    // the near-paper grey of the middle class would leave thin lines invisible.
    const DIV7 = { light: ['#6687A5', '#97AEC3', '#CBD6E1', '#EBECED', '#F9C7BB', '#EC8E79', '#DA4E33'],
                   dark:  ['#6F91AA', '#596F81', '#424F5A', '#3E444A', '#66433D', '#A3513D', '#E25B35'] };
    const OTHER_GREY = { light: '#B5B9BE', dark: '#686E75' };
    const WARM_LIMITS = [-2, -1, -0.5, 0.5, 1, 2];
    const themeKey = () => (d3.hsl(css('--paper')).l < 0.5 ? 'dark' : 'light');
    function warmScale(forLines) {
      const c = DIV7[themeKey()].slice();
      if (forLines) c[3] = OTHER_GREY[themeKey()];
      return d3.scaleThreshold(WARM_LIMITS, c);
    }
    const sg = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
    const warmKey = (col) => col.range().map((c, i) => `<span><i class="cce-sq" style="background:${c};outline:1px solid var(--rule)"></i>${
      i === 0 ? `below ${sg(WARM_LIMITS[0])}` : i === 6 ? `${sg(WARM_LIMITS[5])} or more` : `${sg(WARM_LIMITS[i - 1])} to ${sg(WARM_LIMITS[i])}`}</span>`).join('');
    const DY = daily.map((r) => ({ ...r, pts: r.d.map((di, i) => ({ di, t: r.t[i] })) }));
    const dyLast = DY[DY.length - 1], dyFull = DY.filter((r) => r.c);
    const dyWarm = dyFull.reduce((m, r) => (r.a > m.a ? r : m));
    const recDay = DY.flatMap((r) => r.pts.map((p) => ({ y: r.y, ...p }))).reduce((m, p) => (p.t > m.t ? p : m));
    const dDate = (y, di) => { const d = new Date(Date.UTC(2000, 0, 1 + di)); return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${y}`; };
    const offC = C.get('era5_pi_offset');
    const lastDay = new Date(dyLast.last + 'T00:00:00Z');
    const lastStr = `${lastDay.getUTCDate()} ${lastDay.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${dyLast.y}`;
    const above = DY.filter((r) => r.y < dyLast.y).length, aboveLast = dyLast.pts.length;
    // days of the current year that were warmer than the same calendar day in every year before 2023
    const pre = DY.filter((r) => r.y < 2023);
    const maxPre = new Map(); pre.forEach((r) => r.pts.forEach((p) => maxPre.set(p.di, Math.max(maxPre.get(p.di) ?? -Infinity, p.t))));
    const nWarmer = dyLast.pts.filter((p) => p.t > (maxPre.get(p.di) ?? Infinity)).length;
    root.querySelector('#cce-daily-y0').textContent = DY[0].y;
    root.querySelector('#cce-daily-text').innerHTML = `<p>Earth’s average air temperature goes up and down by about
      ${fmt(d3.mean(dyFull.slice(-10), (r) => d3.max(r.t) - d3.min(r.t)), 1)} °C every year, because the northern hemisphere, with most of the
      land, warms more in its summer. Each line below is one year since ${DY[0].y}, coloured by how much warmer that year was than 1850–1900.
      The warmest day measured was <strong>${dDate(recDay.y, recDay.di)}, ${fmt(recDay.t, 2)} °C</strong>; the warmest year was
      <strong>${dyWarm.y}, ${sgn(dyWarm.a, 2)} °C</strong> above 1850–1900.</p>
      <p>Up to ${lastStr}, ${dyLast.y} was about ${sgn(dyLast.a, 1)} °C above 1850–1900 on average (an approximation for a part-year). On ${nWarmer} of its ${aboveLast} days it was warmer
      than on the same day in any year from ${DY[0].y} to 2022.</p>`;
    (function dailyChart(host) {
      const tip = tipFor(host);
      onSize(host, () => {
        const W = host.clientWidth, H = host.clientHeight, M = { t: 16, r: W < 520 ? 34 : 44, b: 24, l: 34 };
        const col = warmScale(true);
        d3.select(host).select('svg').remove();
        const svg = d3.select(host).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
          .attr('aria-label', `Chart: daily global air temperature for each year ${DY[0].y}–${dyLast.y}, one line per year coloured by the year's warming above 1850–1900. Recent years run highest. Warmest day ${dDate(recDay.y, recDay.di)}, ${fmt(recDay.t, 2)} °C.`);
        const x = d3.scaleLinear([0, 365], [M.l, W - M.r]);
        const y = d3.scaleLinear(d3.extent(DY.flatMap((r) => r.t)), [H - M.b, M.t]).nice();
        const months = d3.range(12).map((m) => ({ m, di: Math.round((Date.UTC(2000, m, 15) - Date.UTC(2000, 0, 1)) / 864e5) }));
        svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(0,${H - M.b})`)
          .call(d3.axisBottom(x).tickValues(months.map((m) => m.di)).tickFormat((di) => new Date(Date.UTC(2000, 0, 1 + di)).toLocaleString('en-GB', { month: W < 520 ? 'narrow' : 'short', timeZone: 'UTC' })).tickSizeOuter(0));
        svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => `${v}°`).tickSizeOuter(0)).select('.domain').remove();
        const ln = d3.line().x((p) => x(p.di)).y((p) => y(p.t)).curve(d3.curveLinear);
        const hi = new Set([dyLast.y, dyWarm.y]);
        svg.append('g').selectAll('path').data(DY.filter((r) => !hi.has(r.y)).sort((p, q) => p.a - q.a)).join('path').attr('class', 'cce-dline')
          .attr('d', (r) => ln(r.pts)).attr('stroke', (r) => col(r.a));
        [dyWarm, dyLast].forEach((r, i) => {
          svg.append('path').attr('class', 'cce-dline cce-dline--hi').attr('d', ln(r.pts)).attr('stroke', col(r.a));
          const e = r.pts[r.pts.length - 1];
          svg.append('text').attr('class', 'cce-dlab').attr('x', Math.min(x(e.di) + 4, W - M.r + 2)).attr('y', y(e.t) + (i ? -6 : 12)).text(r.y);
        });
        svg.append('circle').attr('class', 'cce-dot').attr('r', 4).attr('cx', x(recDay.di)).attr('cy', y(recDay.t));
        svg.append('text').attr('class', 'cce-thr-t').attr('x', x(recDay.di)).attr('y', y(recDay.t) - 8).attr('text-anchor', 'middle')
          .text(`${dDate(recDay.y, recDay.di).replace(/ \d{4}$/, '')} ${recDay.y}: ${fmt(recDay.t, 2)} °C`);
        const guide = svg.append('line').attr('class', 'cce-thr-l').attr('y1', M.t).attr('y2', H - M.b).attr('opacity', 0);
        svg.append('rect').attr('class', 'cce-hover').attr('x', M.l).attr('y', M.t).attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
          .on('mousemove', (ev) => {
            const di = Math.max(0, Math.min(365, Math.round(x.invert(d3.pointer(ev)[0]))));
            const at = (r) => r.pts.find((p) => p.di === di);
            const vals = DY.map((r) => ({ y: r.y, p: at(r) })).filter((v) => v.p);
            if (!vals.length) { tip.hide(); return; }
            const top = vals.reduce((m, v) => (v.p.t > m.p.t ? v : m)), low = vals.reduce((m, v) => (v.p.t < m.p.t ? v : m));
            const cur = at(dyLast);
            guide.attr('x1', x(di)).attr('x2', x(di)).attr('opacity', 1);
            tip.show(`<b>${dDate('', di).trim()}</b>${cur ? `<span class="cce-note">${dyLast.y}: ${fmt(cur.t, 2)} °C</span>` : ''}
              <span class="cce-note">Warmest: ${top.y}, ${fmt(top.p.t, 2)} °C</span><span class="cce-note">Coolest: ${low.y}, ${fmt(low.p.t, 2)} °C</span>`, x(di), y(top.p.t));
          })
          .on('mouseleave', () => { guide.attr('opacity', 0); tip.hide(); });
      });
    })(root.querySelector('#cce-daily'));
    function dailyLegend() {
      // the same classes as the stripes legend (review D4)
      root.querySelector('#cce-daily-leg').innerHTML = `<span>The year’s average, °C compared with 1850–1900:</span>
        ${warmKey(warmScale(true))}
        <span>Thick lines: ${dyWarm.y} (warmest year) and ${dyLast.y} (to ${lastStr})</span>`;
    }
    dailyLegend(); themeHooks.push(dailyLegend);
    dataTable(root.querySelector('#cce-daily').closest('figure'), 'Show the data as a table (one row per year)',
      ['Year', 'Days', 'Year’s average vs 1850–1900, °C', 'Warmest day', 'Its temperature, °C'],
      DY.slice().reverse().map((r) => { const w = r.pts.reduce((m, q) => (q.t > m.t ? q : m));
        return [r.c ? String(r.y) : `${r.y} (to ${dDate(r.y, r.pts[r.pts.length - 1].di).replace(/ \d{4}$/, '')})`, String(r.pts.length), sgn(r.a, 2), dDate(r.y, w.di), fmt(w.t, 2)]; }));
    root.querySelector('#cce-daily-cap').innerHTML = `Global mean air temperature 2 m above the surface, °C, daily average.
      ${dsrc('era5_daily', 'ERA5, Copernicus Climate Change Service / ECMWF (Climate Pulse)')} (CC BY 4.0); contains modified Copernicus Climate Change Service information 2026. Neither the European Commission nor ECMWF is
      responsible for any use that may be made of the Copernicus information or data it contains.
      Final days only. Years are compared with 1850–1900 by adding ${fmt(offC.value, 2)} °C to the difference from 1991–2020, as
      <a href="${esc(offC.source_url)}">Copernicus does</a> for annual values; the current year’s colour uses the days so far. Colours follow the scale of the warming stripes below.
      ERA5 is a reanalysis that starts in ${DY[0].y}; it reads about the same as the measured series in the timeline above, not identically.`;

    // ---------- where the CO2 goes ----------
    const CB = d3.group(carbon, (r) => r.year);
    const cbYears = [...CB.keys()].sort((a, b) => a - b), cbLast = cbYears[cbYears.length - 1];
    const flow = (y, f) => (CB.get(y).find((r) => r.flow === f) || {}).gtco2 || 0;
    const cbMean = (f) => d3.mean(cbYears.filter((y) => y > cbLast - 10), (y) => flow(y, f));
    const emis10 = cbMean('fossil') + cbMean('land_use');
    // A balance: up = released into the air, down = taken out again by the ocean and by plants and soils.
    // Line = what should be left in the air (emitted minus taken up, incl. the small uptake by cement);
    // dots = the increase measured in the air. The gap between them is the Global Carbon Budget's "budget imbalance".
    const SINKS = [['ocean', 'taken up by the ocean', 'blue'], ['land', 'taken up by plants and soils', 'yellow']];
    const SOURCES = [['fossil', 'fossil fuels and cement', 'ink'], ['land_use', 'land use, mostly deforestation', 'muted']];
    const emitted = (yr) => flow(yr, 'fossil') + flow(yr, 'land_use');
    const left = (yr) => emitted(yr) - flow(yr, 'ocean') - flow(yr, 'land') - flow(yr, 'cement_carbonation');
    const sh = Object.fromEntries(['atmosphere', 'ocean', 'land'].map((f) => [f, pct(cbMean(f), emis10)]));
    const left10 = pct(d3.mean(cbYears.filter((y) => y > cbLast - 10), left), emis10);
    root.querySelector('#cce-sink-text').innerHTML = `<p>Over ${cbLast - 9}–${cbLast} people released on average
      <strong>${fmt(emis10, 0)} billion tonnes of CO₂ a year</strong>, ${fmt(pct(cbMean('fossil'), emis10))}% of it from fossil fuels
      and cement, the rest from land use, mostly cutting down forests. Nature took part of it out again: the ocean about
      ${fmt(sh.ocean)}%, plants and soils on land about ${fmt(sh.land)}%. That leaves about <strong>${fmt(left10)}%</strong> in the air.
      Measurements of CO₂ in the air show it gained about ${fmt(sh.atmosphere)}%: close, though not identical, because emissions and
      sinks are estimated separately.</p>
      <p>These natural sinks slow the warming, but they do not remove the problem: the CO₂ that stays in the air lasts for
      centuries, and the CO₂ the ocean takes up makes the water more acidic. The land sink varies a lot from year to year with
      drought, heat and fires.</p>`;
    const sw = ([, t, c]) => `<span><i class="cce-sq" style="background:var(--${c})"></i>${t}</span>`;
    root.querySelector('#cce-sinks-leg').innerHTML = `<div class="cce-legend__row"><span>Billion tonnes of CO₂ a year. Up, released by:</span>${SOURCES.map(sw).join('')}</div>
      <div class="cce-legend__row"><span>Down, taken out again:</span>${SINKS.map(sw).join('')}</div>
      <div class="cce-legend__row"><span><i style="border-color:var(--red)"></i>left in the air (released minus taken up)</span><span><i class="cce-dot-key"></i>increase measured in the air</span></div>`;
    root.querySelector('#cce-sinks-cap').innerHTML = `${dsrc('gcb', 'Global Carbon Budget 2026')}. The line also subtracts the small
      uptake of CO₂ by cement. Emissions, sinks and the increase in the air are estimated separately, so line and dots differ a little
      (the budget imbalance: ${sgn(flow(cbYears[0], 'imbalance'), 1)} billion tonnes in ${cbYears[0]}, ${sgn(flow(cbLast - 1, 'imbalance'), 1)} in ${cbLast - 1},
      ${sgn(flow(cbLast, 'imbalance'), 1)} in ${cbLast}).`;
    dataTable(root.querySelector('#cce-sinks').closest('figure'), 'Show the data as a table (billion tonnes of CO₂ a year)',
      ['Year', 'Fossil fuels and cement', 'Land use', 'Ocean took up', 'Land took up', 'Cement carbonation', 'Rise in the air', 'Imbalance'],
      cbYears.slice().reverse().map((yr) => [String(yr), ...['fossil', 'land_use', 'ocean', 'land', 'cement_carbonation', 'atmosphere'].map((f) => fmt(flow(yr, f), 1)), sgn(flow(yr, 'imbalance'), 1)]));
    (function sinkChart(host) {
      const tip = tipFor(host);
      onSize(host, () => {
        const W = host.clientWidth, H = host.clientHeight, M = { t: 10, r: 8, b: 24, l: 34 };
        d3.select(host).select('svg').remove();
        const svg = d3.select(host).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
          .attr('aria-label', `Chart: CO₂ released per year since ${cbYears[0]}, the part taken up by the ocean and by plants and soils, and what is left in the air; in ${cbLast - 9}–${cbLast} about ${fmt(left10)}% was left in the air.`);
        const x = d3.scaleBand(cbYears, [M.l, W - M.r]).padding(0.15);
        const up = d3.max(cbYears, emitted), dn = d3.max(cbYears, (y) => d3.sum(SINKS, ([f]) => flow(y, f)));
        const y = d3.scaleLinear([-dn, up], [H - M.b, M.t]).nice();
        svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => (v < 0 ? `−${fmt(-v)}` : fmt(v))).tickSizeOuter(0)).select('.domain').remove();
        svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(0,${H - M.b})`)
          .call(d3.axisBottom(x).tickValues(cbYears.filter((v) => v % (W < 520 ? 20 : 10) === 0)).tickSizeOuter(0));
        const stack = (keys, sign) => cbYears.flatMap((yr) => { let acc = 0;
          return keys.map(([f, , c]) => { const v = flow(yr, f), a = acc; acc += v; return { yr, f, c, y0: sign * a, y1: sign * acc }; }); });
        svg.append('g').selectAll('rect').data([...stack(SOURCES, 1), ...stack(SINKS, -1)]).join('rect')
          .attr('x', (d) => x(d.yr)).attr('width', x.bandwidth()).attr('y', (d) => y(Math.max(d.y0, d.y1)))
          .attr('height', (d) => Math.max(0, Math.abs(y(d.y0) - y(d.y1)) - 0.5)).attr('fill', (d) => `var(--${d.c})`).attr('opacity', 0.85);
        svg.append('line').attr('class', 'cce-zero').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(0)).attr('y2', y(0));
        const cx = (yr) => x(yr) + x.bandwidth() / 2;
        svg.append('path').attr('class', 'cce-net').attr('d', d3.line().x(cx).y((yr) => y(left(yr)))(cbYears));
        svg.append('g').selectAll('circle').data(cbYears).join('circle').attr('class', 'cce-net-dot')
          .attr('cx', cx).attr('cy', (yr) => y(flow(yr, 'atmosphere'))).attr('r', Math.max(1.8, Math.min(3, x.bandwidth() / 3)));
        svg.append('g').selectAll('rect').data(cbYears).join('rect').attr('class', 'cce-hover')
          .attr('x', (d) => x(d) - x.step() * x.padding() / 2).attr('width', x.step()).attr('y', M.t).attr('height', H - M.t - M.b)
          .on('mousemove', (ev, yr) => {
            const e = emitted(yr);
            tip.show(`<b>${yr}: ${fmt(e, 1)} billion t CO₂ released</b>${SINKS.map(([f, t]) => `<span class="cce-note">${fmt(flow(yr, f), 1)} ${t} (${fmt(pct(flow(yr, f), e))}%)</span>`).join('')}
              <span class="cce-note">Left in the air: ${fmt(left(yr), 1)} (${fmt(pct(left(yr), e))}%); measured: ${fmt(flow(yr, 'atmosphere'), 1)}</span>`,
              x(yr), d3.pointer(ev)[1]);
          })
          .on('mouseleave', () => tip.hide());
      });
    })(root.querySelector('#cce-sinks'));

    // ---------- horizontal bars, label above each bar (works at any width) ----------
    // Horizontal bars. Labels wrap to the width; a value that does not fit right of its bar moves to the right end of the
    // label line (review D3: nothing may run past the edge at 390 px).
    // keepTop: reserve the reference line's label row even without one, so charts that swap (tabs) keep their rows in place
    function bars(host, rows, { domain, fmtV, aria, refLine, columns, keepTop }) {
      onSize(host, () => {
        const W = host.clientWidth, padR = 64, lineH = 15, top = refLine || keepTop ? 14 : 0;
        d3.select(host).select('svg').remove();
        const svg = d3.select(host).append('svg').attr('role', 'img').attr('aria-label', aria);
        const mLab = svg.append('text').attr('class', 'cce-bar-lab'), mVal = svg.append('text').attr('class', 'cce-bar-val');
        const wOf = (m, s) => m.text(s).node().getComputedTextLength();
        if (columns) {
          // Bars on both sides of zero (design guide, review of "What warms, what cools"): the row label has its own
          // column on the left; the plot starts after it with room for the longest negative value, so a value at a
          // bar's outer end never reaches into the label column. One zero line runs the full height.
          const LW = Math.round(Math.min(W * 0.4, 260)), gapL = 12, rowGap = 12;
          const lo = (r) => Math.min(r.v, r.lo ?? r.v), hi = (r) => Math.max(r.v, r.hi ?? r.v);
          const vNeg = d3.max(rows.filter((r) => r.v < 0), (r) => wOf(mVal, fmtV(r.v))) || 0;
          const vPos = d3.max(rows.filter((r) => r.v >= 0), (r) => wOf(mVal, fmtV(r.v))) || 0;
          const dmin = Math.min(0, d3.min(rows, lo)), dmax = Math.max(0, d3.max(rows, hi));
          const x = d3.scaleLinear([dmin, dmax], [LW + gapL + (vNeg ? vNeg + 6 : 0), W - (vPos ? vPos + 6 : 0)]);
          let yAt = 2;
          const lay = rows.map((r) => {
            const lines = [];
            r.label.split(' ').forEach((w) => {
              const last = lines[lines.length - 1];
              if (last != null && wOf(mLab, `${last} ${w}`) <= LW) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w);
            });
            const o = { r, lines, y: yAt };
            yAt += Math.max(1, lines.length) * lineH + rowGap;
            return o;
          });
          mLab.remove(); mVal.remove();
          const H = yAt;
          svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
          svg.append('line').attr('class', 'cce-zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', H);
          const g = svg.selectAll('g.cce-bar').data(lay).join('g').attr('class', (o) => `cce-bar${o.r.head ? ' cce-bar--head' : ''}`)
            .attr('transform', (o) => `translate(0,${o.y})`);
          g.append('title').text(({ r }) => `${r.label}: ${fmtV(r.v)}${r.lo != null ? ` (range ${fmtV(r.lo)} to ${fmtV(r.hi)})` : ''}`);
          g.append('text').attr('class', 'cce-bar-lab').attr('y', 11).selectAll('tspan').data((o) => o.lines).join('tspan')
            .attr('x', 0).attr('dy', (s, i) => (i ? lineH : 0)).text((s) => s);
          g.append('rect').attr('x', ({ r }) => x(Math.min(0, r.v))).attr('y', 1).attr('height', 11)
            .attr('width', ({ r }) => Math.max(1, Math.abs(x(r.v) - x(0)))).attr('fill', ({ r }) => `var(--${r.c})`);
          g.filter(({ r }) => r.lo != null).append('path').attr('class', 'cce-whisk')
            .attr('d', ({ r }) => `M${x(r.lo)} 2.5v8M${x(r.lo)} 6.5H${x(r.hi)}M${x(r.hi)} 2.5v8`);
          g.append('text').attr('class', 'cce-bar-val').attr('y', 11)
            .attr('x', ({ r }) => (r.v < 0 ? x(lo(r)) - 5 : x(hi(r)) + 5)).attr('text-anchor', ({ r }) => (r.v < 0 ? 'end' : 'start'))
            .text(({ r }) => fmtV(r.v));
          return;
        }
        const dmin = domain ? domain[0] : Math.min(0, d3.min(rows, (r) => r.lo ?? r.v)), dmax = domain ? domain[1] : d3.max(rows, (r) => r.hi ?? r.v);
        const x = d3.scaleLinear([dmin, dmax], [dmin < 0 ? 64 : 2, W - padR]);
        let yAt = top;
        const lay = rows.map((r) => {
          const vw = wOf(mVal, fmtV(r.v));
          const vx = r.v < 0 ? Math.min(x(r.lo ?? r.v), x(r.v)) - 4 : Math.max(x(r.hi ?? r.v), x(r.v)) + 4;
          const fits = r.v < 0 ? vx - vw >= 0 : vx + vw <= W;
          const maxW = fits ? W : W - vw - 10;
          const lines = [];
          r.label.split(' ').forEach((w) => {
            const last = lines[lines.length - 1];
            if (last != null && wOf(mLab, `${last} ${w}`) <= maxW) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w);
          });
          if (r.sep) yAt += 14;   // a gap before a row added from outside the list (the picked country)
          const o = { r, lines, fits, vx, y: yAt };
          yAt += lines.length * lineH + 23;
          return o;
        });
        mLab.remove(); mVal.remove();
        const H = yAt + (refLine ? 4 : 4);
        svg.attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
        const g = svg.selectAll('g.cce-bar').data(lay).join('g').attr('class', (o) => `cce-bar${o.r.head ? ' cce-bar--head' : ''}${o.r.pick ? ' cce-bar--pick' : ''}`)
          .attr('transform', (o) => `translate(0,${o.y})`);
        g.append('title').text(({ r }) => `${r.label}: ${fmtV(r.v)}${r.lo != null ? ` (range ${fmtV(r.lo)} to ${fmtV(r.hi)})` : ''}`);
        g.append('text').attr('class', 'cce-bar-lab').attr('y', 13).selectAll('tspan').data((o) => o.lines).join('tspan')
          .attr('x', 0).attr('dy', (s, i) => (i ? lineH : 0)).text((s) => s);
        const by = (o) => (o.lines.length - 1) * lineH;
        g.append('rect').attr('x', ({ r }) => x(Math.min(0, r.v))).attr('y', (o) => by(o) + 19).attr('height', 11)
          .attr('width', ({ r }) => Math.max(1, Math.abs(x(r.v) - x(0)))).attr('fill', ({ r }) => `var(--${r.c})`);
        g.filter(({ r }) => r.lo != null).append('path').attr('class', 'cce-whisk')
          .attr('d', (o) => { const { r } = o, b = by(o); return `M${x(r.lo)} ${b + 20.5}v8M${x(r.lo)} ${b + 24.5}H${x(r.hi)}M${x(r.hi)} ${b + 20.5}v8`; });
        g.append('text').attr('class', 'cce-bar-val')
          .attr('y', (o) => (o.fits ? by(o) + 29 : 13)).attr('x', (o) => (o.fits ? o.vx : W))
          .attr('text-anchor', (o) => (!o.fits ? 'end' : o.r.v < 0 ? 'end' : 'start')).text(({ r }) => fmtV(r.v));
        if (dmin < 0) g.append('line').attr('class', 'cce-zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', (o) => by(o) + 17).attr('y2', (o) => by(o) + 32);
        if (refLine) {
          svg.append('line').attr('class', 'cce-thr-l').attr('x1', x(refLine.v)).attr('x2', x(refLine.v)).attr('y1', 10).attr('y2', H);
          svg.append('text').attr('class', 'cce-thr-t').attr('x', x(refLine.v) + 3).attr('y', 9).text(refLine.t);
        }
      });
    }

    // ---------- contributions to warming (IPCC SPM.2) ----------
    const DR = new Map(drivers.map((d) => [d.driver_id, d]));
    const obs = DR.get('observed'), hum = DR.get('human_total'), ghg = DR.get('ghg_wellmixed'), oth = DR.get('other_human'), nat = DR.get('natural'), iv = DR.get('variability');
    const subs = drivers.filter((d) => d.panel === 'substance');
    const co2d = DR.get('co2'), ch4d = DR.get('ch4'), so2d = DR.get('so2');
    const sv = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v), 2);
    root.querySelector('#cce-drv-text').innerHTML = `<p>Over 2010–2019 Earth’s surface was about <strong>${fmt(obs.value_c, 2)} °C</strong> warmer than in
      1850–1900. The IPCC attributes about <strong>${fmt(hum.value_c, 2)} °C</strong> to human influence (likely
      ${fmt(hum.low_c, 1)} to ${fmt(hum.high_c, 1)} °C): in short, all of it. The sun and volcanoes contributed
      ${nat.value_c === 0 ? 'about nothing' : sv(nat.value_c) + ' °C'} (${sv(nat.low_c)} to ${sv(nat.high_c)} °C), and so did natural swings within the climate.</p>
      <p>Greenhouse gases warmed by about ${fmt(ghg.value_c, 1)} °C. Other human pollution, mainly aerosols such as the sulphate formed from burning coal and oil,
      cooled by about ${fmt(-oth.value_c, 1)} °C, mainly through particles that reflect sunlight and brighten clouds. That cooling
      hides part of the warming.</p>
      <p>By substance, carbon dioxide caused the most warming (${sv(co2d.value_c)} °C), then methane (${sv(ch4d.value_c)} °C).
      Sulphur dioxide cooled most (${sv(so2d.value_c)} °C). Each bar counts everything a substance does once emitted, including the
      gases and particles it forms in the air.</p>`;
    const C2 = (v) => (v > 0 ? 'red' : 'blue');
    bars(root.querySelector('#cce-drv'), [
      { label: 'Observed warming', v: obs.value_c, lo: obs.low_c, hi: obs.high_c, c: 'ink', head: true },
      { label: 'All human influence', v: hum.value_c, lo: hum.low_c, hi: hum.high_c, c: 'ink', head: true },
      { label: 'Greenhouse gases', v: ghg.value_c, lo: ghg.low_c, hi: ghg.high_c, c: 'red', head: true },
      { label: 'Other human influence (mainly aerosols)', v: oth.value_c, lo: oth.low_c, hi: oth.high_c, c: 'blue', head: true },
      { label: 'Sun and volcanoes', v: nat.value_c, lo: nat.low_c, hi: nat.high_c, c: 'muted', head: true },
      { label: 'Natural swings in the climate', v: iv.value_c, lo: iv.low_c, hi: iv.high_c, c: 'muted', head: true },
      ...subs.slice().sort((a, b) => b.value_c - a.value_c).map((d) => ({ label: d.label, v: d.value_c, lo: d.low_c, hi: d.high_c, c: C2(d.value_c) })),
    ], { columns: true, fmtV: (v) => `${sv(v)} °C`, aria: `Chart: contributions to warming in 2010–2019. Human influence ${fmt(hum.value_c, 2)} °C; carbon dioxide ${sv(co2d.value_c)} °C, methane ${sv(ch4d.value_c)} °C, sulphur dioxide ${sv(so2d.value_c)} °C.` });
    root.querySelector('#cce-drv-cap').innerHTML = `Warming in 2010–2019 compared with 1850–1900, °C. Red warms, blue cools. Bold rows sum up, the rest are single substances.
      Whiskers: very likely range (5–95%), except for the bold rows below “Observed warming”: likely range, as the IPCC assesses them. ${dsrc('spm2', 'IPCC AR6 WGI, Figure SPM.2 data')} (Szopa et al. 2021, CC BY 4.0).`;

    // ---------- emissions by gas and sector ----------
    const GAS = [['co2_fossil', 'CO₂ from fossil fuels and cement'], ['co2_land_use', 'CO₂ from land use (mostly deforestation)'],
      ['ch4', 'Methane (CH₄)'], ['n2o', 'Nitrous oxide (N₂O)'], ['fgas', 'F-gases (HFCs, PFCs, SF₆, NF₃)']];
    const gY = d3.max(gases, (r) => r.year), g0 = d3.min(gases, (r) => r.year);
    const gv = (id, y) => (gases.find((r) => r.gas_id === id && r.year === y) || {}).gtco2e;
    const gTot = (y) => d3.sum(GAS, ([id]) => gv(id, y));
    const gShare = (id) => pct(gv(id, gY), gTot(gY));
    root.querySelector('#cce-gas-text').innerHTML = `<p>In ${gY} the world emitted about <strong>${fmt(gTot(gY))} billion tonnes</strong> of
      greenhouse gases, counted in CO₂-equivalents (each gas weighted by how much it warms over 100 years compared with CO₂).
      That is ${fmt(pct(gTot(gY) - gTot(g0), gTot(g0)))}% more than in ${g0}. CO₂ makes up about ${fmt(gShare('co2_fossil') + gShare('co2_land_use'))}%, methane
      ${fmt(gShare('ch4'))}%.</p>
      <p>By sector (${sectors[0].year}, the IPCC’s latest assessment), most comes from producing energy: power and heat plants, and the extraction and refining of fuels
      (${fmt(sectors[0].share_pct)}%). Then come ${sectors.slice(1).map((s) => `${esc(s.label.toLowerCase())} (${fmt(s.share_pct)}%)`).join(', ')}. ${esc((sectors.find((s) => s.sector_id === 'energy_supply') || {}).note || '')}</p>`;
    root.querySelector('#cce-gas-t').textContent = `By gas, ${gY}, billion tonnes CO₂-equivalent`;
    bars(root.querySelector('#cce-gas'), GAS.map(([id, l]) => ({ label: l, v: gv(id, gY), c: id.startsWith('co2') ? 'ink' : 'muted' })),
      { fmtV: (v) => `${fmt(v, 1)} (${fmt(pct(v, gTot(gY)))}%)`, aria: `Chart: greenhouse-gas emissions by gas in ${gY}.` });
    root.querySelector('#cce-gas-cap').innerHTML = `Weights over 100 years from the IPCC’s Fifth Assessment (methane 28, nitrous oxide 265), as EDGAR uses.
      CO₂: ${dsrc('gcb', 'Global Carbon Budget 2026')}; other gases: ${dsrc('edgar', 'EDGAR 2026')}.`;
    const sY = sectors[0].year;
    root.querySelector('#cce-sec-t').textContent = `By sector, ${sY}, share of all greenhouse gases`;
    bars(root.querySelector('#cce-sec'), sectors.map((s) => ({ label: s.label, v: s.share_pct, c: 'muted' })),
      { domain: [0, 40], fmtV: (v) => `${fmt(v)}%`, aria: `Chart: greenhouse-gas emissions by sector in ${sY}.` });
    root.querySelector('#cce-sec-cap').innerHTML = `Emissions counted where they are produced. <a href="${esc(sectors[0].source_url)}">IPCC AR6 WGIII, SPM ${esc(sectors[0].location.replace('SPM ', ''))}</a>
      (latest assessed year; rounded, so the shares add up to ${fmt(d3.sum(sectors, (s) => s.share_pct))}%). The IPCC weights the gases as in its
      Sixth Assessment, the chart by gas as in the Fifth, so the two are not exactly comparable.`;

    // ---------- countries ----------
    const cty = countries.filter((c) => c.kind === 'country'), cY = countries[0].year;
    const wTot = d3.sum(countries, (c) => c.mtco2), wCum = d3.sum(countries, (c) => c.cum_gtco2);
    const pop = d3.sum(cty.filter((c) => c.tco2_pp > 0), (c) => c.mtco2 / c.tco2_pp);
    const wPP = wTot / pop;
    const top = (k, n) => cty.slice().sort((a, b) => b[k] - a[k]).slice(0, n);
    const NTOP = 15;   // every chart of this section shows the 15 largest (the per-person text compares them too)
    const big = top('mtco2', NTOP);
    const t1 = big[0], c1 = top('cum_gtco2', 1)[0], ppHi = big.slice().sort((a, b) => b.tco2_pp - a.tco2_pp)[0], ppLo = big.slice().sort((a, b) => a.tco2_pp - b.tco2_pp)[0];
    root.querySelector('#cce-cty-text').innerHTML = `<p>Where the CO₂ comes from depends on how you count. In ${cY}, ${esc(cname(t1))} emitted the most fossil CO₂,
      <strong>${fmt(pct(t1.mtco2, wTot))}%</strong> of the world total. Counted since 1850, ${esc(theName(cname(c1)))} emitted the most,
      <strong>${fmt(pct(c1.cum_gtco2, wCum))}%</strong>, and it is the total since then that drives the warming. Per person, among the
      ${big.length} largest emitters, someone in ${esc(cname(ppHi))} emitted about ${fmt(ppHi.tco2_pp, 1)} tonnes in ${cY}, someone in
      ${esc(cname(ppLo))} about ${fmt(ppLo.tco2_pp, 1)}; the world average was ${fmt(wPP, 1)}.</p>`;
    // The reader can pick any country: its bar turns red (red = the reader's selection); a country outside the list is
    // added at the bottom, after a gap, with its rank among all countries and territories by that measure.
    let ctyPick = '';
    // rank = 1 + the number of countries with a larger value, so equal values share a rank
    const rankIn = (k) => { const s = cty.filter((c) => c[k] != null); return (c) => [1 + s.filter((x) => x[k] > c[k]).length, s.length]; };
    const withPick = (list, k, val, outsideLabel) => {
      const rows = list.map((c) => ({ label: cname(c), v: val(c), c: c.iso3 === ctyPick ? 'red' : 'ink', pick: c.iso3 === ctyPick }));
      const c = ctyPick && !list.some((x) => x.iso3 === ctyPick) ? cty.find((x) => x.iso3 === ctyPick) : null;
      if (c && c[k] != null) rows.push({ label: outsideLabel(c), v: val(c), c: 'red', sep: true, pick: true });
      return rows;
    };
    // shares and amounts small enough for a picked country to need more precision than the 12 largest
    const share = (p) => (p < 0.05 ? 'under 0.1%' : `${fmt(p, p < 1 ? 1 : 0)}%`);
    // (countries.json stores Mt to 0.1 and Gt since 1850 to 0.01: never show more digits than that)
    const mtTxt = (mt) => (mt < 0.1 ? 'under 0.1 Mt' : `${fmt(mt, mt < 10 ? 1 : 0)} Mt`);
    const rankLabel = (k) => (c) => { const [r, n] = rankIn(k)(c); return `${cname(c)} (no. ${r} of ${n})`; };
    const CT = [
      ['total', `In ${cY}`, () => withPick(top('mtco2', NTOP), 'mtco2', (c) => c.mtco2 / 1000, rankLabel('mtco2')), (v) => `${v < 0.1 ? mtTxt(v * 1000) : `${fmt(v, 1)} Gt`} (${share(pct(v * 1000, wTot))})`, null],
      ['pp', 'Per person', () => withPick(big.slice().sort((a, b) => b.tco2_pp - a.tco2_pp), 'tco2_pp', (c) => c.tco2_pp,
        (c) => { const [r, n] = rankIn('tco2_pp')(c); return `${cname(c)} (no. ${r} of ${n} per person)`; }), (v) => `${fmt(v, 1)} t`, { v: wPP, t: `world ${fmt(wPP, 1)} t` }],
      ['cum', 'Since 1850', () => withPick(top('cum_gtco2', NTOP), 'cum_gtco2', (c) => c.cum_gtco2, rankLabel('cum_gtco2')), (v) => `${v < 0.01 ? 'under 0.01' : fmt(v, v < 1 ? 2 : v < 10 ? 1 : 0)} Gt (${share(pct(v, wCum))})`, null],
    ];
    const CAP = {
      total: `Fossil CO₂ in ${cY}, billion tonnes, the ${NTOP} largest emitters; share of the world total including international shipping and aviation.`,
      pp: `The ${big.length} largest emitters, compared per person: fossil CO₂ per person in ${cY}, tonnes. A country picked from outside them is shown with its rank among all countries per person.`,
      cum: `Fossil CO₂ 1850–${cY}, billion tonnes, within today’s borders; the ${NTOP} largest.`,
    };
    const ctTabs = root.querySelector('#cce-cty-tabs'), ctPick = root.querySelector('#cce-cty-pick');
    let ctyK = 'total';
    ctPick.innerHTML = `<option value="">None</option>${cty.slice().sort((a, b) => cname(a).localeCompare(cname(b), 'en'))
      .map((c) => `<option value="${esc(c.iso3)}">${esc(cname(c))}</option>`).join('')}`;
    ctPick.addEventListener('change', () => { ctyPick = ctPick.value; setCty(ctyK); });
    CT.forEach(([k, t]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = t; b.addEventListener('click', () => setCty(k)); ctTabs.appendChild(b); });
    function setCty(k) {
      ctyK = k;
      const ctyHost = root.querySelector('#cce-cty');
      ctTabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
      const [, t, rows, f, ref] = CT.find((c) => c[0] === k);
      const fresh = ctyHost.cloneNode(false); ctyHost.replaceWith(fresh);   // drops the old resize observer
      const rs = rows(), pr = rs.find((r) => r.c === 'red');
      bars(fresh, rs, { fmtV: f, refLine: ref, keepTop: true, aria: `Chart: fossil CO₂ by country, ${t.toLowerCase()}.${pr ? ` Highlighted: ${pr.label}, ${f(pr.v)}.` : ''}` });
      const picked = ctyPick ? cty.find((c) => c.iso3 === ctyPick) : null;
      root.querySelector('#cce-cty-cap').innerHTML = `${CAP[k]}${picked ? ` In red: ${esc(cname(picked))}${picked[{ total: 'mtco2', pp: 'tco2_pp', cum: 'cum_gtco2' }[k]] == null ? ' (no figure for this measure)' : ''}.` : ''} Counted where emitted, not where the goods are used; EU countries are shown
        separately. ${dsrc('gcb_country', 'Global Carbon Project 2026')}`;
    }
    setCty('total');


    // ================= How it shows up =================
    const IM = new Map(impacts.map((r) => [r.id, r]));
    const IND = d3.group(indicators, (r) => r.i);
    const LEVELS = [1, 1.5, 2, 4];
    const HAZ = [['heat50', 'Heat extreme', 'that happened once in 50 years'], ['heat10', 'Heat extreme', 'once in 10 years'],
      ['rain10', 'Heaviest one-day rain', 'once in 10 years'], ['drought10', 'Farm drought', 'once in 10 years, in drying regions']];
    const imv = (h, l) => (IM.get(`${h}_${l}`) || {}).value;
    const now2100 = () => per(SC.get(cur).code, '2081-2100').best_c;
    function drawExt() {
      const g2010s = mean('obs_global', 2010, 2019);
      root.querySelector('#cce-ext-text').innerHTML = `<p>Each bit of warming makes extremes more frequent. Over land, a heat extreme that
        happened once in 50 years in 1850–1900 happens about <strong>${fmt(imv('heat50', 1), 1)} times</strong> as often at 1 °C of
        global warming; the 2010s averaged ${sgn(g2010s)} °C. At 2 °C it would be about ${fmt(imv('heat50', 2), 0)} times, at 4 °C about
        ${fmt(imv('heat50', 4), 0)} times. Heavy rain grows more frequent too, and so do droughts in regions that are drying, though less steeply.</p>
        <p>Today, over ${yrs10}, the world was at about ${sgn(g10)} °C. With <span class="cce-cur">${esc(L(cur))}</span> it would reach about
        ${sgn(now2100())} °C by 2081–2100 (switch the path at the top of the page).</p>`;
    }
    (function extChart(host) {
      host.innerHTML = HAZ.map(([h, t, s]) => `<div class="cce-ext__p"><p class="cce-ext__t"><strong>${esc(t)}</strong> ${esc(s)}</p>
        <div class="cce-ext__bars" role="img" aria-label="${esc(`${t}, ${s}: ${LEVELS.map((l) => `${fmt(imv(h, l), 1)} times as often at ${l} °C`).join(', ')}`)}">
        ${[[0, 1], ...LEVELS.map((l) => [l, imv(h, l)])].map(([l, v], k) => { const mx = imv(h, 4);
          return `<div class="cce-ext__c${l === 0 ? ' cce-ext__c--base' : ''}"><span class="cce-ext__v">${l === 0 ? '1' : `×${fmt(v, 1)}`}</span>
            <i data-k="${k}" style="--p:${(v / mx).toFixed(4)}"></i><span class="cce-ext__l">${l === 0 ? '1850–1900' : `+${l} °C`}</span></div>`; }).join('')}
        </div></div>`).join('');
    })(root.querySelector('#cce-ext'));
    root.querySelector('#cce-ext-cap').innerHTML = `How many times as often an extreme over land happens at each level of global warming, compared with
      1850–1900 (median of climate models; each panel has its own scale). The models’ ranges are wide, especially for drought: at 1 °C
      some show no increase in farm drought. <a href="${esc(IM.get('heat50_1').source_url)}">IPCC AR6 WGI, Figure SPM.6 data</a> (Li &amp; Hauser 2021, CC BY 4.0).`;

    // observed: sea ice and ocean heat, computed from the yearly series
    const ice9 = IND.get('arctic_sept_extent') || [], ohc = IND.get('ocean_heat_2000m') || [];
    const slope = (a) => { const mx = d3.mean(a, (r) => r.y), my = d3.mean(a, (r) => r.v);
      return d3.sum(a, (r) => (r.y - mx) * (r.v - my)) / d3.sum(a, (r) => (r.y - mx) ** 2); };
    const iceRef = d3.mean(ice9.filter((r) => r.y >= 1981 && r.y <= 2010), (r) => r.v);
    const iceTrend = slope(ice9) * 10 / iceRef * 100;   // % per decade relative to 1981-2010, as NSIDC states it
    const iceLow = ice9.reduce((m, r) => (r.v < m.v ? r : m), { v: Infinity });
    const ohc0 = ohc[0], ohcN = ohc[ohc.length - 1];
    let ohcRec = 0; for (let i = ohc.length - 1; i > 0 && ohc[i].v > d3.max(ohc.slice(0, i), (r) => r.v); i--) ohcRec++;
    const lnk = (url, text) => `<a href="${esc(url)}">${esc(text)}</a>`;
    function spark(rows, cls) {
      const W = 240, H = 50, x = d3.scaleLinear(d3.extent(rows, (r) => r.y), [2, W - 2]), y = d3.scaleLinear(d3.extent(rows, (r) => r.v), [H - 4, 4]);
      const l = rows[rows.length - 1];
      return `<svg class="cce-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path class="cce-line ${cls}" d="${d3.line().x((r) => x(r.y)).y((r) => y(r.v))(rows)}"/>
        <circle cx="${x(l.y)}" cy="${y(l.v)}" r="3"/><text x="0" y="${H + 12}">${rows[0].y}</text><text x="${W}" y="${H + 12}" text-anchor="end">${l.y}</text></svg>`;
    }
    const card = (group, fig, label, text, src, extra = '') => `<article class="cce-card"><p class="cce-card__g">${esc(group)}</p>
      <p class="cce-card__fig">${fig}</p><p class="cce-card__l">${label}</p>${extra}<p class="cce-card__t">${text}</p><p class="cce-src">${src}</p></article>`;
    const r = (id) => IM.get(id) || {};
    root.querySelector('#cce-obs-text').innerHTML = `<p>Most of what follows has been measured; one card looks ahead. The IPCC
      attributes more frequent and severe extremes (high confidence), coral bleaching and drought-related tree deaths, and
      more heat-related deaths (medium confidence) to human-caused climate change <span class="cce-src">(${lnk('https://doi.org/10.1017/9781009325844.001', 'IPCC AR6 WGII, SPM B.1.1')}; ${lnk('https://doi.org/10.1017/9781009157896.001', 'WGI, SPM A.3')})</span>.</p>`;
    root.querySelector('#cce-cards').innerHTML = [
      card('Sea level', `+${fmt(r('sl_1901').value, 2)} m`, `global mean, ${esc(r('sl_1901').period)}`, esc(r('sl_1901').statement),
        `${lnk(r('sl_1901').source_url, 'IPCC AR6 WGI, SPM A.1.7')}. More: <a href="https://thomassie.me/sea-level-cities/">Sea-level Cities</a>`),
      card('Sea level', `+${fmt(r('sl_sat').value)} mm`, `measured by satellites, ${esc(r('sl_sat').period)}`, esc(r('sl_sat').statement), lnk(r('sl_sat').source_url, `NASA${asOf(r('sl_sat'))}`)),
      card('Arctic sea ice', `${sgn(iceTrend, 0)}%`, `September extent per decade, ${ice9[0].y}–${ice9[ice9.length - 1].y}`,
        `Compared with the 1981–2010 average. The smallest extent on record was in ${iceLow.y}: ${fmt(iceLow.v, 2)} million km².`,
        lnk(DS.get('nsidc').source_url, 'NSIDC Sea Ice Index'), spark(ice9, 'cce-line--sea')),
      card('Glaciers', `${fmt(r('glaciers').value)} Gt`, `ice lost a year, ${esc(r('glaciers').period)} (${fmt(r('glaciers').low)}–${fmt(r('glaciers').high)})`,
        esc(r('glaciers').statement), lnk(r('glaciers').source_url, 'GlaMBIE 2025, Nature')),
      card('Ice sheets', `${fmt(r('icesheets').value)} Gt`, `Greenland and Antarctica, ${esc(r('icesheets').period)}`, esc(r('icesheets').statement),
        lnk(r('icesheets').source_url, 'Otosaka et al. 2023 (IMBIE)')),
      card('Ocean heat', `+${fmt(ohcN.v - ohc0.v)} ZJ`, `upper 2,000 m, ${ohc0.y}–${ohcN.y}`,
        `A zettajoule is 10²¹ joules. ${ohcRec >= 2 ? `Each of the last ${ohcRec} years set a new record.` : ohcRec === 1 ? `${ohcN.y} set a new record.` : ''}`,
        lnk(DS.get('ncei_ohc').source_url, 'NOAA NCEI'), spark(ohc, 'cce-line--land')),
      card('Ocean acidity', `−${fmt(r('ph_rate').low, 3)} to −${fmt(r('ph_rate').high, 3)}`, `pH units per decade, surface open ocean, ${esc(r('ph_rate').period)}`,
        `${esc(r('ph_rate').statement)} ${esc(r('ph').statement)}`,
        `${lnk(r('ph_rate').source_url, 'IPCC SROCC, SPM A.2.5')}; ${lnk(r('ph').source_url, 'IPCC AR6 WGI, SPM A.1.6 and A.2.4')}`),
      card('Coral reefs', `${fmt(r('coral_obs').value)}%`, `of reef area hit by bleaching-level heat, ${esc(r('coral_obs').period)}`, esc(r('coral_obs').statement),
        lnk(r('coral_obs').source_url, `NOAA Coral Reef Watch${asOf(r('coral_obs'))}`)),
      card('Coral reefs, ahead', `${fmt(r('coral_proj').low)}–${fmt(r('coral_proj').high)}%`, 'further decline at 1.5 °C', esc(r('coral_proj').statement),
        lnk(r('coral_proj').source_url, 'IPCC SR1.5, SPM B.4.2')),
      card('Heat deaths', `${fmt(r('heatdeaths').value)}%`, `of warm-season heat deaths caused by climate change, ${esc(r('heatdeaths').period)}`,
        esc(r('heatdeaths').statement), lnk(r('heatdeaths').source_url, 'Vicedo-Cabrera et al. 2021')),
      card('Heatwaves', `${fmt(r('pnw').value)}×`, 'at least as likely as without climate change: the Pacific Northwest heat of June 2021', esc(r('pnw').statement),
        lnk(r('pnw').source_url, 'Philip et al. 2022')),
      card('People', `${fmt(r('vulnerable').low, 1)}–${fmt(r('vulnerable').high, 1)} bn`, 'people highly vulnerable to climate change', esc(r('vulnerable').statement),
        lnk(r('vulnerable').source_url, 'IPCC AR6 WGII, SPM B.2')),
      card('Food', `−${fmt(r('food_tfp').value)}%`, `global farm productivity since 1961, compared with a world without climate change`,
        `${esc(r('food').statement)} ${esc(r('food_tfp').statement)}`,
        `${lnk(r('food_tfp').source_url, 'Ortiz-Bobea et al. 2021, Nature Climate Change')}; ${lnk(r('food').source_url, 'IPCC AR6 WGII, SPM B.1.3')}`),
      card('Displacement', `${fmt(r('displacement_stock').value, 1)} million`, `people still living in internal displacement because of disasters on ${esc(r('displacement_stock').period)}`,
        `${esc(r('displacement').statement)} ${esc(r('displacement_stock').statement)}`,
        `${lnk(r('displacement').source_url, 'IPCC AR6 WGII, SPM B.1.7')}; ${lnk(r('displacement_stock').source_url, 'IDMC, Global Report on Internal Displacement 2026')}`),
    ].join('');


    // ================= Your lifetime =================
    const BORN_MIN = 1930, BORN_MAX = lastObs;
    const around = (sid, y, h = 5) => mean(sid, y - h, y + h);
    const projAt = (s, y) => (y > 2094 ? mean(`proj_global_${s}`, 2090, 2099) : around(`proj_global_${s}`, y, 5));
    let born = 1990;
    function drawLife() {
      const atBirth = around('obs_global', born), age80 = born + 80;
      const late = age80 > 2094;
      const paths = SSPS.map((s) => `${esc(L(s))} <strong>${sgn(projAt(s, age80))} °C</strong>`).join(', ');
      // the 80th birthday may lie in the measured past (born up to lastObs - 80): then it is measured, not projected (review A6)
      const past80 = age80 <= lastObs, recent = born > lastObs - 10;
      root.querySelector('#cce-life-text').innerHTML = `<p>Around ${born}, the world was about <strong>${sgn(atBirth)} °C</strong> warmer
        than in 1850–1900 (the average of the measured years around it).${recent ? '' : ` Over ${yrs10} it was <strong>${sgn(g10)} °C</strong>: about
        ${fmt(Math.max(0, g10 - atBirth), 1)} °C of warming in your lifetime so far.`}</p>
        <p>${past80 ? `You turned 80 in ${age80}; by then the world was about <strong>${sgn(around('obs_global', age80))} °C</strong>
          warmer than in 1850–1900 (measured).`
        : `${late ? `By the 2090s, the end of the IPCC projections, you would be about ${2095 - born}` : `In ${age80}, when you turn 80`},
        the world would be about: ${paths} (global mean; the very likely ranges are in the timeline above).`}</p>`;
      stripes();
    }
    function stripes() {
      const host = root.querySelector('#cce-stripes');
      const obs = pts('obs_global').filter((r) => r.y >= born), proj = pts(`proj_global_${cur}`).filter((r) => r.y > lastObs);
      const rows = [...obs.map((r) => ({ ...r, k: 'measured' })), ...proj.map((r) => ({ ...r, k: 'projected' }))];
      const W = host.clientWidth, H = 130, M = { t: 32, b: 22 };
      const x = d3.scaleBand(rows.map((r) => r.y), [0, W]);
      const col = warmScale();
      d3.select(host).select('svg').remove();
      const svg = d3.select(host).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
        .attr('aria-label', `Warming stripes from ${born} to 2099: one stripe per year, blue cooler and red warmer than 1850–1900; measured to ${lastObs}, then ${L(cur)}.`);
      svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.y)).attr('width', x.bandwidth() + 0.6)
        .attr('y', M.t).attr('height', H - M.t - M.b).attr('fill', (r) => col(r.v))
        .append('title').text((r) => `${r.y}: ${sgn(r.v)} °C (${r.k}${r.k === 'projected' ? `, ${L(cur)}` : ''})`);
      // markers; a label moves up a row when it would touch the previous one
      const marks = [[born, `${born}: born`], [lastObs, `${lastObs}: today`], [born + 80, `${born + 80}: age 80`]].filter(([y]) => y >= born && y <= 2099);
      let prevEnd = -Infinity, row = 0;
      marks.forEach(([y, lab], i) => {
        const px = x(y) + x.bandwidth() / 2, w = lab.length * 6.6;
        let left = Math.min(Math.max(0, px - (i === 0 ? 0 : w / 2)), W - w);
        row = left < prevEnd + 8 ? 1 - row : 0; prevEnd = left + w;
        svg.append('line').attr('class', 'cce-stripe-m').attr('x1', px).attr('x2', px).attr('y1', M.t - 4 - row * 14).attr('y2', H - M.b + 4);
        svg.append('text').attr('class', 'cce-stripe-t').attr('x', left).attr('y', M.t - 7 - row * 14).text(lab);
      });
      svg.append('text').attr('class', 'cce-stripe-t').attr('x', 0).attr('y', H - 6).text(`measured to ${lastObs}`);
      svg.append('text').attr('class', 'cce-stripe-t').attr('x', W).attr('y', H - 6).attr('text-anchor', 'end').text(`then ${L(cur)}`);
      root.querySelector('#cce-stripes-leg').innerHTML = `<span>°C compared with 1850–1900:</span>${warmKey(col)}`;
    }
    root.querySelector('#cce-stripes-cap').innerHTML = `One stripe per year, global mean. Measured: ${src('obs_global', 'HadCRUT5')}; projected:
      ${src(`proj_global_ssp245`, 'IPCC AR6 SPM.8')} (central estimate of the path chosen at the top of the page). Design after Ed Hawkins’ (University of Reading)
      <a href="https://showyourstripes.info/">warming stripes</a> (CC BY 4.0).`;
    const bornEl = root.querySelector('#cce-born'), bornMsg = root.querySelector('#cce-born-msg');
    bornEl.min = BORN_MIN; bornEl.max = BORN_MAX;
    bornEl.addEventListener('input', () => {
      const v = Math.round(Number(bornEl.value));
      if (!Number.isFinite(v) || v < BORN_MIN || v > BORN_MAX) { bornMsg.textContent = `Enter a year from ${BORN_MIN} to ${BORN_MAX}.`; return; }
      bornMsg.textContent = ''; born = v; drawLife();
    });
    new ResizeObserver(() => stripes()).observe(root.querySelector('#cce-stripes'));


    // ================= Where you live =================
    // Country land temperature is relative to 1951-1980 (the grid covers every country only from then);
    // world land is shifted to the same reference with the offset stored for the timeline series.
    const LOC = local.map((c) => { const all = c.v.map((v, i) => ({ y: c.f + i, v }));
      return { ...c, name: CNAME.get(c.iso3) || c.name, all, pts: all.filter((r) => r.v != null) }; })
      .sort((a, b) => a.name.localeCompare(b.name));
    const landOff = SER.get('obs_land').offset_c;
    const wl = pts('obs_land').map((r) => ({ y: r.y, v: r.v - landOff }));
    const run10 = (a) => a.map((r, i) => { const w = a.filter((q) => q.y > r.y - 10 && q.y <= r.y); return w.length >= 8 ? { y: r.y, v: d3.mean(w, (q) => q.v) } : null; }).filter(Boolean);
    const m10 = (a) => d3.mean(a.filter((r) => r.y > lastObs - 10 && r.y <= lastObs), (r) => r.v);
    const wl10 = m10(wl), wlPre = mean('obs_land', 1951, 1980);
    const rankOf = new Map(LOC.map((c) => [c.iso3, m10(c.pts)]).sort((a, b) => b[1] - a[1]).map(([k], i) => [k, i + 1]));
    const sel = root.querySelector('#cce-country');
    sel.innerHTML = LOC.map((c) => `<option value="${esc(c.iso3)}">${esc(c.name)}</option>`).join('');
    const region = (() => { try { return new Intl.Locale(navigator.language).maximize().region; } catch (e) { return null; } })();
    let place = (LOC.find((c) => c.iso2 === region) || LOC.find((c) => c.iso3 === 'DEU') || LOC[0]).iso3;
    sel.value = place;
    sel.addEventListener('change', () => { place = sel.value; drawLocal(); });
    function drawLocal() {
      const c = LOC.find((q) => q.iso3 === place), c10 = m10(c.pts), hot = c.pts.reduce((m, r) => (r.v > m.v ? r : m), { v: -Infinity });
      dataTable(root.querySelector('#cce-local-chart').closest('figure'), `Show the data as a table (${c.name}, °C compared with 1951–1980)`,
        ['Year', `${c.name}, land`, 'World land'],
        c.all.slice().reverse().map((r) => { const w = wl.find((q) => q.y === r.y); return [String(r.y), r.v == null ? 'too few measurements' : sgn(r.v, 2), w ? sgn(w.v, 2) : '–']; }));
      const ratio = c10 / wl10;
      const pace = ratio > 1.1 ? 'faster than' : ratio < 0.9 ? 'slower than' : 'about as fast as';
      root.querySelector('#cce-local-text').innerHTML = `<p>Over ${yrs10}, land in <strong>${esc(theName(c.name))}</strong> was on average
        <strong>${sgn(c10)} °C</strong> warmer than in 1951–1980; land worldwide was ${sgn(wl10)} °C warmer. ${esc(theName(c.name, true))} warmed ${pace}
        the world’s land: it ranks ${rankOf.get(c.iso3)} of the ${LOC.length} countries and territories here. Its warmest year on record was ${hot.y} (${sgn(hot.v)} °C).</p>
        <p>This section compares with 1951–1980, not 1850–1900, because measurements cover every country only from then. World land had
        already warmed by about ${fmt(wlPre, 1)} °C between 1850–1900 and 1951–1980.</p>`;
      const host = root.querySelector('#cce-local-chart');
      const W = host.clientWidth, H = host.clientHeight, M = { t: 14, r: 10, b: 24, l: 34 };
      d3.select(host).select('svg').remove();
      const svg = d3.select(host).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
        .attr('aria-label', `Chart: land temperature in ${c.name} compared with 1951–1980, ${c.pts[0].y}–${lastObs}, against world land. ${yrs10}: ${sgn(c10)} °C, world land ${sgn(wl10)} °C.`);
      const x = d3.scaleLinear([1850, lastObs], [M.l, W - M.r]);
      const ext = d3.extent([...c.pts, ...wl.filter((r) => r.y >= 1850)], (r) => r.v);
      const y = d3.scaleLinear([Math.min(-1.5, ext[0]), Math.max(2.5, ext[1])], [H - M.b, M.t]).nice();
      svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(0,${H - M.b})`).call(d3.axisBottom(x).ticks(W < 480 ? 4 : 8).tickFormat(d3.format('d')).tickSizeOuter(0));
      svg.append('g').attr('class', 'cce-axis').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')).tickSizeOuter(0)).select('.domain').remove();
      svg.append('rect').attr('class', 'cce-future').attr('x', x(1951)).attr('width', x(1980) - x(1951)).attr('y', M.t).attr('height', H - M.t - M.b);
      svg.append('text').attr('class', 'cce-thr-t').attr('x', x(1951) + 3).attr('y', M.t + 10).text('1951–1980');
      svg.append('line').attr('class', 'cce-zero').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(0)).attr('y2', y(0));
      const ln = d3.line().defined((r) => r).x((r) => x(r.y)).y((r) => y(r.v));
      svg.append('path').attr('class', 'cce-line cce-line--land cce-line--thin').attr('d', d3.line().defined((r) => r.v != null).x((r) => x(r.y)).y((r) => y(r.v))(c.all));
      svg.append('path').attr('class', 'cce-line cce-line--glob cce-line--proj').attr('d', ln(run10(wl.filter((r) => r.y >= 1850))));
      svg.append('path').attr('class', 'cce-line cce-line--land').attr('d', ln(run10(c.pts)));
      const tip = host.__tip || (host.__tip = tipFor(host));
      const dot = svg.append('circle').attr('class', 'cce-dot').attr('r', 4).attr('opacity', 0);
      svg.append('rect').attr('class', 'cce-hover').attr('x', M.l).attr('y', M.t).attr('width', W - M.l - M.r).attr('height', H - M.t - M.b)
        .on('mousemove', (ev) => { const yr = Math.round(x.invert(d3.pointer(ev)[0])), r = c.pts.find((q) => q.y === yr);
          if (!r) { dot.attr('opacity', 0); tip.hide(); return; }
          const w = wl.find((q) => q.y === yr);
          dot.attr('cx', x(r.y)).attr('cy', y(r.v)).attr('opacity', 1);
          tip.show(`<b>${r.y}: ${sgn(r.v)} °C</b><span class="cce-note">${esc(c.name)}, land${w ? `; world land ${sgn(w.v)} °C` : ''}</span>`, x(r.y), y(r.v)); })
        .on('mouseleave', () => { dot.attr('opacity', 0); tip.hide(); });
    }
    root.querySelector('#cce-local-leg').innerHTML = `<span>°C compared with 1951–1980</span><span><i style="border-color:var(--red);opacity:.5"></i>each year</span>
      <span><i style="border-color:var(--red)"></i>10-year average</span><span><i style="border-color:var(--ink);border-top-style:dashed"></i>world land, 10-year average</span>`;
    root.querySelector('#cce-local-cap').innerHTML = `Land only (air temperature over land). Our area-weighted averages of the
      <a href="https://doi.org/10.5281/zenodo.20428381">Berkeley Earth High Resolution</a> 0.25° grid (April 2026, a preliminary release, not yet peer reviewed, so values may change; CC BY-NC 4.0) within
      <a href="https://www.naturalearthdata.com/">Natural Earth</a> borders; years shown only where measurements cover at least 90% of the country’s land.
      Too few measurements for: Ethiopia, Sudan, South Sudan, Somalia, Central African Republic, Solomon Islands; very small countries are left out.
      Units follow Natural Earth’s map: territories it draws on their own, such as Greenland, Puerto Rico and New Caledonia, and areas with
      disputed status, such as Western Sahara, Somaliland and Kosovo, are listed separately; the Baikonur Cosmodrome and uninhabited
      territories are left out. Names follow the emissions chart above. The IPCC gives projections by region, not by country:
      <a href="https://interactive-atlas.ipcc.ch/">IPCC Interactive Atlas</a>.`;
    new ResizeObserver(() => drawLocal()).observe(root.querySelector('#cce-local-chart'));
    themeHooks.push(drawLife, drawLocal);



    // ================= 24 places (Copernicus Interactive Climate Atlas: ERA5 + CMIP6 by global warming level) =================
    if (places) {
      const IND = [   // label, unit, decimals, what a higher value means for the colour (warm = red, wet = blue, dry = yellow)
        ['t', 'Average temperature', '°C', 1, 'warm'],
        ['txx', 'Hottest day of the year', '°C', 1, 'warm'],
        ['tx35', 'Days above 35 °C', 'days', 0, 'warm'],
        ['tr', 'Tropical nights (above 20 °C)', 'nights', 0, 'warm'],
        ['fd', 'Frost days (below 0 °C)', 'days', 0, 'cold'],
        ['pr', 'Rain and snow in a year', 'mm', 0, 'wet'],
        ['rx1day', 'Wettest day of the year', 'mm', 0, 'wet'],
        ['cdd', 'Longest dry spell', 'days', 0, 'dry'],
      ];
      const PER = places[0].periods;            // e.g. ['1850-1900', '1991-2020', '+1.5', '+2', '+3', '+4']
      const lvl = (p) => parseFloat(p);          // NaN for the two reference periods
      const nearLevel = () => { const g = per(SC.get(cur).code, '2081-2100').best_c; return PER.filter((p) => p.startsWith('+')).reduce((m, p) => (Math.abs(lvl(p) - g) < Math.abs(lvl(m) - g) ? p : m)); };
      let placeId = places[0].id;
      const pick = root.querySelector('#cce-place-pick');
      pick.innerHTML = places.map((p) => `<button type="button" data-id="${esc(p.id)}" aria-pressed="false">${esc(p.name)}</button>`).join('');
      pick.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) { placeId = b.dataset.id; drawCard(); } });
      const fmtI = (v, d) => (v == null ? '–' : fmt(v, d));
      // Day counts add the models' change to ERA5's count. Where the models' own 1991-2020 count is far from ERA5's (more than
      // twice or half, and 5 days apart), that change starts from a different point, so the future count is uncertain: flag it.
      const shaky = (p, id) => {
        if (!['tx35', 'tr', 'fd'].includes(id)) return null;
        const c = p.v[id] && p.v[id]['1991-2020']; if (!c || c[4] == null) return null;
        const [e, m] = [c[0], c[4]], r = (m + 1) / (e + 1);
        return (r > 2 || r < 0.5) && Math.abs(m - e) >= 5 ? { era5: e, models: m } : null;
      };
      const UNIT = { tx35: 'days', tr: 'nights', fd: 'days' };
      // "What happens there", in words: each sentence is built from the card's own numbers (1991-2020 vs the highlighted level)
      function story(p, k) {
        const g = (id, per) => (p.v[id] && p.v[id][per]) || null;
        const now = (id) => (g(id, '1991-2020') || [])[0], at = (id) => (g(id, k) || [])[0];
        const agree = (id) => { const c = g(id, k), r = now(id); return c && c[1] != null && Math.sign(c[1] - r) === Math.sign(c[2] - r); };
        const days = (v, n = 'day') => `${fmt(v)} ${n}${Math.round(v) === 1 ? '' : 's'}`;
        const out = [];
        if (now('t') != null && at('t') != null) out.push([9, `On average about <strong>${fmt(at('t') - now('t'), 1)} °C warmer</strong> than in 1991–2020${g('t', '1850-1900') ? `, and ${fmt(at('t') - g('t', '1850-1900')[0], 1)} °C warmer than around 1850–1900` : ''}.`]);
        if (now('txx') != null && at('txx') != null) out.push([8, `The hottest day of a typical year reaches about <strong>${fmt(at('txx'), 0)} °C</strong>, instead of ${fmt(now('txx'), 0)} °C.`]);
        const flag = (id) => (shaky(p, id) ? ' <span class="cce-card__flag">(uncertain, see the table)</span>' : '');
        const count = (id, what, w, n = 'day') => {
          const a = now(id), b = at(id); if (a == null || b == null) return;
          if (shaky(p, id)) w -= 3;   // an uncertain count is not the card's headline
          if (Math.round(a) < 1 && Math.round(b) >= 1) out.push([w + 2, `${what}, almost unknown today, come about <strong>${days(b, n)}</strong> a year${flag(id)}.`]);
          else if (Math.round(b) - Math.round(a) >= 1) out.push([w + Math.min(3, (b - a) / Math.max(a, 5)), `${what}: about <strong>${days(b, n)}</strong> a year instead of ${fmt(a)}${flag(id)}.`]);
        };
        count('tx35', 'Days above 35 °C', 7);
        count('tr', 'Nights that stay above 20 °C', 6, 'night');
        if (now('fd') >= 1 && at('fd') != null) {
          const a = now('fd'), b = at('fd');
          out.push([5 + Math.min(3, (a - b) / Math.max(a, 5)), b < 1 ? `Frost almost disappears (about ${fmt(a)} frost days a year in 1991–2020).` : `Frost days: about <strong>${fmt(b)}</strong> a year instead of ${fmt(a)}${flag('fd')}.`]);
        }
        const rel = (id) => (at(id) / now(id) - 1) * 100;
        if (now('pr') > 0 && at('pr') != null) {
          const r = rel('pr');
          out.push([Math.abs(r) >= 5 && agree('pr') ? 5 : 2, Math.abs(r) < 5 ? 'Rain and snow over the year change little in the models’ median.'
            : agree('pr') ? `About <strong>${fmt(Math.abs(r))}% ${r > 0 ? 'more' : 'less'}</strong> rain and snow in a year; the models agree on the direction.`
            : `Rain and snow over the year: ${fmt(Math.abs(r))}% ${r > 0 ? 'more' : 'less'} in the models’ median, but they disagree whether it gets wetter or drier.`]);
        }
        if (now('rx1day') > 0 && at('rx1day') != null && rel('rx1day') >= 3) out.push([4 + (agree('rx1day') ? 1 : 0), `The wettest day of the year brings about <strong>${fmt(rel('rx1day'))}% more rain</strong>${agree('rx1day') ? '' : ' (models disagree)'}.`]);
        if (now('cdd') != null && at('cdd') != null && Math.round(at('cdd')) - Math.round(now('cdd')) >= 2) out.push([4 + (agree('cdd') ? 1 : 0), `The longest dry spell lasts about <strong>${days(at('cdd'))}</strong> instead of ${fmt(now('cdd'))}${agree('cdd') ? '' : ' (models disagree)'}.`]);
        return out.sort((x, y) => y[0] - x[0]).map((s) => s[1]);
      }
      function drawCard() {
        pick.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === placeId)));
        const p = places.find((q) => q.id === placeId), hl = nearLevel();
        const head = PER.map((k) => `<th scope="col"${k === hl ? ' class="cce-card__hl"' : ''}>${k.startsWith('+') ? `${k} °C<span>world</span>` : `${k}<span>${k === '1991-2020' ? 'area average' : 'models'}</span>`}</th>`).join('');
        const rows = IND.filter(([id]) => p.v[id]).map(([id, label, unit, d, kind]) => {
          const ref = p.v[id]['1991-2020'] && p.v[id]['1991-2020'][0];
          const cells = PER.map((k) => {
            const c = p.v[id][k];
            if (!c) return `<td>–</td>`;
            const [v, lo, hi, n] = c, dv = ref == null ? 0 : v - ref;
            const rel = ref ? dv / Math.max(Math.abs(ref), unit === '°C' ? 4 : 1) : 0;
            const tone = k === '1991-2020' || Math.abs(dv) < 10 ** -d ? '' : (kind === 'warm' ? (dv > 0 ? 'hot' : 'cool') : kind === 'cold' ? (dv < 0 ? 'hot' : 'cool') : kind === 'wet' ? (dv > 0 ? 'wet' : 'dry') : (dv > 0 ? 'dry' : 'wet'));
            const a = Math.min(1, Math.abs(rel)).toFixed(2);
            return `<td${k === hl ? ' class="cce-card__hl"' : ''}${tone ? ` data-tone="${tone}" style="--a:${a}"` : ''}><b>${fmtI(v, d)}</b>${lo != null ? `<span>${fmtI(lo, d)}${lo < 0 || hi < 0 ? ' to ' : '–'}${fmtI(hi, d)}</span>` : ''}</td>`;
          }).join('');
          return `<tr><th scope="row">${esc(label)}${shaky(p, id) ? ' <span class="cce-card__flag" aria-label="uncertain">*</span>' : ''}<span>${esc(unit)}</span></th>${cells}</tr>`;
        }).join('');
        const shakyNote = IND.filter(([id]) => shaky(p, id)).map(([id, label]) => { const s = shaky(p, id);
          return `${esc(label)}: ERA5 counts ${fmt(s.era5)} ${UNIT[id]} a year in 1991–2020, the models ${fmt(s.models)}`; });
        const n4 = Object.values(p.v).map((o) => (o['+4'] || [])[3]).filter(Number.isFinite), nM = Math.min(...n4), nX = Math.max(...n4);
        const ll = (v, pos, neg) => `${fmt(Math.abs(v), 1)}° ${v >= 0 ? pos : neg}`;
        root.querySelector('#cce-card').innerHTML = `<header><div><h3>${esc(p.name)}<span>${esc(p.country)}</span></h3><p>${esc(p.why)}</p></div>
          <svg class="cce-card__map" role="img" data-label="${esc(`Locator map: ${p.name}, ${ll(p.lat, 'N', 'S')}, ${ll(p.lon, 'E', 'W')}`)}"
            aria-label="${esc(`Locator map: ${p.name}`)}"></svg></header>
          <div class="cce-card__story"><h4>What happens there if the world is ${esc(hl.slice(1))} °C warmer than in 1850–1900</h4>
          <ul>${story(p, hl).map((s) => `<li>${s}</li>`).join('')}</ul>
          <p class="cce-note">Compared with 1991–2020; median of the climate models. Choose another path at the top of the page to see another warming level.</p></div>
          <p class="cce-note">The 1991–2020 values are averages over the area around ${esc(p.name)} (ERA5, cells about 25 km across), not a weather station’s record: a station in town can differ, most where mountains, ice or the sea are close. The changes are the robust part.</p>
          <p class="cce-card__swipe" aria-hidden="true">Swipe the table for the warming levels →</p><div class="cce-card__scroll"><table><thead><tr><th scope="col"><span class="cce-sr">Indicator</span></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
          <p class="cce-note">Shaded: change from 1991–2020 (red hotter, blue colder or wetter, yellow drier). Small numbers: range of the
          middle 80% of climate models. Column highlighted: the warming level nearest the path chosen at the top (${esc(L(cur))}).
          ${Number.isFinite(nM) ? `At +4 °C only ${nM === nX ? nM : `${nM} to ${nX}`} models count, those that get that warm before 2100.` : ''}</p>
          ${shakyNote.length ? `<p class="cce-note"><span class="cce-card__flag">*</span> Uncertain: ${shakyNote.join('; ')}. The models’ change in ${shakyNote.length > 1 ? 'these counts starts' : 'this count starts'} from a different number than ERA5’s, so the future count${shakyNote.length > 1 ? 's are' : ' is'} only a rough guide. Near a threshold such as 35 °C or 20 °C, a small difference in temperature changes the count a lot.</p>` : ''}`;
      }
      root.querySelector('#cce-places-text').innerHTML = `<p>Global averages hide what warming does in a given place. For ${places.length} places
        in different climates, these cards show eight measures of heat, cold, rain and drought: around 1850–1900, in 1991–2020 and at
        four levels of global warming. A warming level is the world as a whole being that much warmer than in 1850–1900, whenever that
        happens; the path chosen at the top of the page decides how far it goes.</p>`;
      root.querySelector('#cce-places-cap').innerHTML = `1991–2020: ERA5 (measurement-based reanalysis), grid cell nearest the place.
        1850–1900 and warming levels: ERA5 1991–2020 plus the change the climate models (CMIP6, SSP5-8.5) show for the surrounding 1°
        grid cell, median and 10th–90th percentile; temperatures and day counts add the models’ change, rain amounts and dry spells
        take their change in percent; a warming level is the 20 years around the year each model first reaches it.
        The model cells are about 100 km across and ERA5’s about 25 km, so a city’s own extra heat is not included, and the wettest day is lower than at a single station.
        Data: Copernicus Climate Change Service, <a href="https://doi.org/10.24381/cds.h35hb680">Gridded dataset underpinning the Copernicus Interactive Climate Atlas</a> (CC BY 4.0);
        warming-level years: <a href="https://doi.org/10.5281/zenodo.3691645">IPCC AR6 Atlas</a>; locator maps: <a href="https://www.naturalearthdata.com/">Natural Earth</a> 1:50m (public domain), a section of the globe centred on the place, its scale bar true at the centre. Projections, not forecasts.`;
      // locator map in the card header (site/_shared/locator.js, Natural Earth 1:50m; same as Sea-level Cities)
      let world = null;
      const drawMap = () => { const el = root.querySelector('.cce-card__map'), p = places.find((q) => q.id === placeId);
        if (el && world) FCC.locator(el, world, { lon: p.lon, lat: p.lat, cls: 'cce-loc' }); };
      const drawAll = () => { drawCard(); drawMap(); };
      pick.addEventListener('click', drawMap);   // after drawCard, which the first listener runs
      (FCC.locator ? Promise.resolve() : new Promise((ok, no) => {   // embeds that list scripts by hand may not include locator.js: load it
        const s = document.createElement('script'); s.src = `${base}locator.js`; s.onload = ok; s.onerror = no; document.head.append(s);
      })).then(() => FCC.locatorWorld(base)).then((w) => { world = w; drawMap(); }).catch(() => { world = null; root.querySelector('#cce-card').classList.add('cce-card--nomap'); });
      let wPrev = 0;
      new ResizeObserver(() => { const el = root.querySelector('.cce-card__map'), w = el && el.clientWidth; if (w && w !== wPrev) { wPrev = w; drawMap(); } }).observe(root.querySelector('#cce-card'));
      drawAll();
      cardHook = drawAll;
    }

    // ================= What decides it =================
    const F = new Map(facts.map((f) => [f.fact_id, f.value]));
    const tcre = C.get('tcre'), hw = C.get('human_warming_2025'), hwr = C.get('human_warming_rate');
    const bud = (tc, lk) => budgets.find((b) => b.target_c === tc && b.likelihood_pct === lk);
    const b15 = bud(1.5, 50), b15s = bud(1.5, 67), b17 = bud(1.7, 50), b20 = bud(2, 50);
    const bFrom = b15.from_year;
    // emissions in the last year: fossil + land use - uptake by cement (as the budget paper counts them)
    const eLast = flow(cbLast, 'fossil') + flow(cbLast, 'land_use') - flow(cbLast, 'cement_carbonation');
    const yrsLeft = (b) => b.gtco2 / eLast;
    const cumAll = F.get('cum_co2_total');
    const hit15 = cbLast + (1.5 - hw.value) / (hwr.value / 10);
    root.querySelector('#cce-budget-text').innerHTML = `<p>How much warmer it gets depends above all on one number: the total
      amount of CO₂ people release. Every 1,000 billion tonnes adds about <strong>${fmt(tcre.value, 2)} °C</strong>
      (likely ${fmt(tcre.low, 2)} to ${fmt(tcre.high, 2)} °C; <a href="${esc(tcre.source_url)}">IPCC, ${esc(tcre.location)}</a>). The warming does not
      fade when emissions stop; it is reversed only if more CO₂ is removed from the air than emitted (SPM D.1.6).
      From 1850 to ${cbLast} people emitted about <strong>${fmt(Math.round(cumAll / 10) * 10)} billion tonnes</strong> of CO₂, about
      ${fmt(pct(F.get('cum_co2_land_use'), cumAll))}% of it from clearing land (${dsrc('gcb', 'Global Carbon Budget')}).</p>
      <p>For an even chance of keeping warming below 1.5 °C, about <strong>${fmt(b15.gtco2)} billion tonnes</strong> were left at the
      start of ${bFrom}: at ${cbLast}’s rate of ${fmt(eLast)} billion tonnes a year, that is <strong>about ${fmt(yrsLeft(b15))} years</strong> of emissions.
      For 2 °C, ${fmt(b20.gtco2)} billion tonnes were left, about ${fmt(yrsLeft(b20))} years. Human-caused warming stood at ${fmt(hw.value, 2)} °C in ${cbLast}
      (range ${fmt(hw.low, 1)} to ${fmt(hw.high, 1)}) and rose by ${fmt(hwr.value, 2)} °C a decade (${fmt(hwr.low, 1)} to ${fmt(hwr.high, 1)}) (<a href="${esc(hw.source_url)}">Forster et al. 2026</a>); if that pace held, it would pass 1.5 °C
      around ${Math.round(hit15)}.</p>`;
    bars(root.querySelector('#cce-budget'), [
      { label: `Emitted 1850–${cbLast}`, v: cumAll, c: 'ink', head: true },
      { label: `Left for 1.5 °C (even chance; ${b15s.likelihood_pct}% chance: ${fmt(b15s.gtco2)})`, v: b15.gtco2, c: 'red' },
      { label: `Left for ${fmt(b17.target_c, 1)} °C (even chance)`, v: b17.gtco2, c: 'red' },
      { label: 'Left for 2 °C (even chance)', v: b20.gtco2, c: 'red' },
    ], { fmtV: (v) => `${fmt(v)} bn t`, aria: `Chart: ${fmt(cumAll)} billion tonnes of CO₂ emitted 1850–${cbLast}; left from ${bFrom}: ${fmt(b15.gtco2)} for 1.5 °C, ${fmt(b17.gtco2)} for 1.7 °C, ${fmt(b20.gtco2)} for 2 °C (even chance).` });
    root.querySelector('#cce-budget-cap').innerHTML = `Billion tonnes of CO₂. Remaining budgets from the start of ${bFrom}:
      <a href="${esc(b15.source_url)}">Forster et al. 2026, Indicators of Global Climate Change 2025</a>, ${esc(b15.location)}; “even chance” is a 50%
      chance of staying below the limit, counting only the uncertainty in how strongly temperature responds to CO₂. The budgets assume other
      greenhouse gases are cut too; if they are not, less is left. Emitted: ${dsrc('gcb', 'Global Carbon Budget 2026')}, fossil fuels, cement and land use.`;

    // the levers: net zero CO2, fast methane cuts
    const PW = d3.group(pathways, (r) => r.target);
    const tgts = [...PW.keys()].sort();
    const cut = (tg, g, y) => PW.get(tg).find((r) => r.gas === g && r.year === y);
    const t15 = tgts.find((k) => k.startsWith('1.5')), t20 = tgts.find((k) => k.startsWith('2'));
    const ch4w = drivers.find((d) => d.driver_id === 'ch4'), co2w = drivers.find((d) => d.driver_id === 'co2');
    root.querySelector('#cce-cuts-text').innerHTML = `<p><strong>Net zero.</strong> Warming from CO₂ stops rising only once
      people add no more CO₂ to the air than they remove: net zero (<a href="${esc(tcre.source_url)}">IPCC, ${esc(tcre.location)}</a>).
      The date matters less than the path there, because every tonne emitted on the way counts. In the pathways the IPCC assessed
      that keep warming to 1.5 °C, net CO₂ emissions fall by about <strong>${fmt(cut(t15, 'co2', 2030).reduction_pct)}%</strong> by 2030
      and ${fmt(cut(t15, 'co2', 2040).reduction_pct)}% by 2040, compared with 2019; for 2 °C by ${fmt(cut(t20, 'co2', 2030).reduction_pct)}%
      and ${fmt(cut(t20, 'co2', 2040).reduction_pct)}%.</p>
      <p><strong>Methane.</strong> Methane caused about ${fmt(ch4w.value_c, 1)} °C of the warming up to 2010–2019, against ${fmt(co2w.value_c, 1)} °C
      from CO₂ (${dsrc('spm2', 'IPCC SPM.2')}). Unlike CO₂, most of it breaks down in the air within about a decade, so cutting it slows
      warming soon. The IPCC notes that strong, rapid and sustained methane cuts would also limit the warming that comes as cleaner
      air removes cooling pollution,
      and would improve air quality. In the 1.5 °C pathways methane falls by about ${fmt(cut(t15, 'ch4', 2030).reduction_pct)}% by 2030.</p>`;
    const GN = { co2: 'Net CO₂', ch4: 'Methane' };
    const cutRows = [t15, t20].flatMap((tg) => ['co2', 'ch4'].flatMap((g) => [2030, 2040].map((y) => { const r = cut(tg, g, y);
      return { label: `${tg.startsWith('1.5') ? '1.5 °C' : '2 °C'}: ${GN[g]}, ${y}`, v: r.reduction_pct, lo: r.low_pct, hi: r.high_pct, c: g === 'co2' ? 'ink' : 'yellow' }; })));
    bars(root.querySelector('#cce-cuts'), cutRows, { domain: [0, 110], fmtV: (v) => `−${fmt(v)}%`,
      aria: `Chart: cuts compared with 2019 in IPCC pathways. ${cutRows.map((r) => `${r.label}: ${fmt(r.v)}%`).join('; ')}.` });
    root.querySelector('#cce-cuts-cap').innerHTML = `Cut compared with modelled 2019 emissions; bar = median of the pathways, whisker = their 5th to 95th percentile, as the IPCC gives it in brackets
      (above 100% means more CO₂ removed than emitted). 1.5 °C: more than 50% chance, with no or limited overshoot; 2 °C: more than 67% chance,
      acting immediately. <a href="${esc(pathways[0].source_url)}">IPCC AR6 WGIII, Summary for Policymakers</a>, ${esc(pathways[0].location)}.
      These are model pathways, not forecasts.`;

    // ---------- method ----------
    const mb = root.querySelector('.cce-method__body');
    const ORDER = ['lgmr', 'temp12k', 'pages2k', 'obs_land', 'obs_sea', 'obs_global', `proj_global_ssp245`];
    const updated = meta && meta[0] && meta[0].generated_at ? d3.utcFormat('%-d %B %Y')(new Date(meta[0].generated_at)) : null;
    mb.innerHTML = `${updated ? `<p class="cce-updated">Data updated ${updated}.</p>` : ''}<p>All temperatures are differences from the 1850–1900 average, which the IPCC uses for pre-industrial
      times. Each measured series is shifted by its own 1850–1900 mean. The reconstructions before 1850 are tied to it
      through the PAGES 2k reconstruction, which overlaps both the thermometer era and the older records.</p>
      <ul>${ORDER.filter((s) => SER.has(s)).map((s) => { const r = SER.get(s);
        return `<li><strong>${esc(r.label.replace(/ \(ssp\d+\)/, ''))}:</strong> <a href="${esc(r.source_url)}">${esc(r.source)}</a>;
          shaded range: ${esc(r.range_kind)}; original reference ${esc(r.native_baseline)}. <span class="cce-lic">${esc(r.licence || '')}.</span></li>`; }).join('')}</ul>
      <p><strong>Land and sea surface after ${lastObs}.</strong> The IPCC assesses future warming only as a global mean.
      It states that land will warm more than the ocean surface, likely ${fmt(ratio.low, 1)} to ${fmt(ratio.high, 1)} times more
      (<a href="${esc(ratio.source_url)}">SPM B.2.1</a>). We split the IPCC’s global projection with its central value, ${fmt(ratio.value, 1)} (AR6 WGI Chapter 4), and land’s share of Earth’s surface, ${fmt(landShare.value * 100)}%
      (<a href="${esc(landShare.source_url)}">USGS</a>); the shaded ranges combine the IPCC’s very likely global range with the ends of the ratio’s likely range, so they are our
      estimate, not an IPCC range. The ratio is for air temperature over land and over the ocean; we apply it to the
      sea-surface (water) temperature, an approximation.
      Climate models (CMIP6) give a similar ratio but warm about a tenth more by 2100, because the IPCC narrowed their range
      with the observed warming.</p>
      <p><strong>Landmarks.</strong> Each line has its source in its note. Dates of geological events are approximate.</p>
      <p><strong>Causes and contributions.</strong></p>
      <ul>${datasets.map((d) => `<li><strong>${esc(d.label)}:</strong> <a href="${esc(d.source_url)}">${esc(d.source)}</a>; ${esc(d.licence)}.</li>`).join('')}
        <li><strong>Emissions by sector:</strong> <a href="${esc(sectors[0].source_url)}">IPCC AR6 WGIII Summary for Policymakers</a>, ${esc(sectors[0].location)}.</li>
        <li><strong>Remaining carbon budget, human-caused warming:</strong> <a href="${esc(b15.source_url)}">Forster et al. 2026</a>, CC BY 4.0.</li>
        <li><strong>Extremes at each level of warming:</strong> Li, C. &amp; Hauser, M. 2021, IPCC AR6 WGI SPM, data for Figure SPM.6 (v20210809), NERC EDS Centre
          for Environmental Data Analysis, <a href="https://doi.org/10.5285/93d1b84fbb144901809eaf67b35eb5c4">doi:10.5285/93d1b84fbb144901809eaf67b35eb5c4</a>,
          cited 22 November 2026; CC BY 4.0.</li>
        <li><strong>Country warming:</strong> our averages of the <a href="https://doi.org/10.5281/zenodo.20428381">Berkeley Earth High Resolution</a> grid
          (Rohde, Hausfather &amp; Calvert 2026; <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a>, non-commercial use only)
          within <a href="https://www.naturalearthdata.com/">Natural Earth</a> borders (public domain); our world-land average from the same grid matches Berkeley Earth’s
          published land series within 0.01 °C for ${yrs10}.</li></ul>`;

    // ---------- go ----------
    setScenario(cur);
    FCC.scrolly({ root: root.querySelector('.story'), steps: '.step', onStep: (i) => chart.go(i) });
  }
})();
