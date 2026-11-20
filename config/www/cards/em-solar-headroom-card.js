const cardType = "em-solar-headroom-card";
const defaultEntity = "sensor.energy_manager_plan";
const minute = 60000;
const hour = 60 * minute;
const energyTolerance = 1e-7;

function finite(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonnegative(value) {
  const parsed = finite(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function extractIntervals(timeline, earliest) {
  if (!Array.isArray(timeline)) return [];
  const intervals = [];

  for (const row of timeline) {
    const start = Date.parse(row?.ts);
    const minutes = finite(row?.interval_minutes);
    if (!Number.isFinite(start) || !(minutes > 0)) continue;
    const end = start + minutes * minute;
    if (end <= earliest) continue;

    const inputs = row.inputs;
    const expected = row.expected;
    const solar = nonnegative(inputs?.pv_kw);
    const house = nonnegative(inputs?.load_kw);
    const ev = nonnegative(inputs?.ev_charge_kw ?? row.ev?.charge_kw);
    const totalLoad = nonnegative(inputs?.total_load_kw) ??
      (house !== null && ev !== null ? house + ev : null);
    const charge = nonnegative(expected?.battery_charge_kw);
    const discharge = nonnegative(expected?.battery_discharge_kw);
    const gridImport = nonnegative(expected?.grid_import_kw);
    const gridExport = nonnegative(expected?.grid_export_kw);
    if ([solar, totalLoad, charge, discharge, gridImport, gridExport].includes(null)) continue;

    // Only use forecast exports that can be attributed to solar. Keep the planned
    // battery charge intact and don't assume curtailed production can recover.
    const headroom = gridImport > 0.005 ? 0 :
      Math.max(0, Math.min(solar - totalLoad - charge, gridExport - discharge));
    intervals.push({ start, end, headroom, sellPrice: finite(inputs?.sell_price) });
  }

  return intervals.sort((a, b) => a.start - b.start);
}

function scoreWindow(intervals, start, duration, power) {
  const end = start + duration;
  const required = power * duration / hour;
  let cursor = start;
  let covered = 0;
  let exportImpact = 0;
  let allPricesKnown = true;

  for (const interval of intervals) {
    if (interval.end <= cursor) continue;
    if (interval.start > cursor) return null;
    const segmentEnd = Math.min(interval.end, end);
    const solarEnergy = Math.min(power, interval.headroom) * (segmentEnd - cursor) / hour;
    covered += solarEnergy;
    if (solarEnergy > energyTolerance) {
      if (interval.sellPrice === null) allPricesKnown = false;
      else exportImpact += solarEnergy * interval.sellPrice;
    }
    cursor = segmentEnd;
    if (cursor === end) {
      return {
        start, end, required, covered: Math.min(required, covered),
        fullSolar: required - covered <= energyTolerance,
        exportImpact: allPricesKnown ? exportImpact : null,
      };
    }
  }
  return null;
}

function bestWindow(intervals, earliest, minutes, power) {
  const duration = minutes * minute;
  const starts = new Set([earliest]);
  // With piecewise-constant forecasts, the best window can start or end at
  // a forecast boundary. Consider both, including partial first or last rows.
  for (const interval of intervals) {
    starts.add(interval.start);
    starts.add(interval.end);
    starts.add(interval.start - duration);
    starts.add(interval.end - duration);
  }

  let best = null;
  for (const start of [...starts].filter((value) => value >= earliest).sort((a, b) => a - b)) {
    const candidate = scoreWindow(intervals, start, duration, power);
    if (!candidate) continue;
    if (!best || candidate.covered > best.covered + energyTolerance ||
        (Math.abs(candidate.covered - best.covered) <= energyTolerance &&
          candidate.exportImpact !== null &&
          (best.exportImpact === null || candidate.exportImpact < best.exportImpact - energyTolerance))) {
      best = candidate;
    }
  }
  return best;
}

class EmSolarHeadroomCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          --headroom-muted: var(--secondary-text-color, #626974);
          --headroom-accent: var(--energy-solar-color, #d89013);
          --headroom-border: var(--divider-color, #d9dde2);
          color: var(--primary-text-color, #202329);
          padding: 16px;
          container-type: inline-size;
        }
        [hidden] { display: none !important; }
        h2, h3, p { margin: 0; }
        header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        ha-icon { --mdc-icon-size: 20px; color: var(--headroom-accent); }
        h2 { font-size: 16px; line-height: 1.25; font-weight: 600; }
        .controls, .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .controls { margin: 0 0 12px; }
        label, .metric span, #status, #note, #result-label {
          font-size: 12px;
          color: var(--headroom-muted);
          line-height: 1.35;
        }
        label { display: grid; gap: 4px; min-width: 0; }
        input {
          box-sizing: border-box;
          border-radius: 7px;
          border: 1px solid var(--headroom-border);
          background: var(--card-background-color, transparent);
          color: var(--primary-text-color, #202329);
          font: inherit;
          font-size: 16px;
          min-width: 0;
          width: 100%;
          padding: 6px 8px;
        }
        input:focus-visible { outline: 2px solid var(--primary-color, #007f79); outline-offset: 1px; }
        #result {
          --coverage-color: #d97706;
          --coverage-track: var(--divider-color, #8885);
        }
        #result[data-coverage="full"] { --coverage-color: #eab308; }
        #result[data-coverage="none"] {
          --coverage-color: #dc2626;
          --coverage-track: var(--coverage-color);
        }
        .window {
          border-radius: 8px;
          border-left: 3px solid var(--coverage-color);
          background: color-mix(in srgb, var(--coverage-color) 9%, transparent);
          padding: 8px 10px;
          margin-bottom: 8px;
        }
        h3 { font-size: 15px; line-height: 1.35; margin-top: 2px; }
        .metric {
          padding: 8px;
          min-width: 0;
          border-radius: 8px;
          background: color-mix(in srgb, var(--headroom-muted) 9%, transparent);
        }
        .metric strong { display: block; font-size: 17px; font-variant-numeric: tabular-nums; }
        .metric span { display: block; margin-top: 3px; }
        progress {
          display: block;
          width: 100%;
          height: 6px;
          margin: 8px 0;
          appearance: none;
          border: 0;
          border-radius: 3px;
          overflow: hidden;
          background: var(--coverage-track);
        }
        progress::-webkit-progress-bar { background: var(--coverage-track); }
        progress::-webkit-progress-value { background: var(--coverage-color); }
        progress::-moz-progress-bar { background: var(--coverage-color); }
        #note { margin-top: 8px; }
        @container (max-width: 225px) { .metric strong { font-size: 14px; } }
      </style>
      <ha-card>
        <header>
          <ha-icon icon="mdi:solar-power-variant" aria-hidden="true"></ha-icon>
          <h2 id="title"></h2>
        </header>
        <div class="controls">
          <label>Appliance power (kW)
            <input id="power" type="number" min="0.1" step="0.1" inputmode="decimal" required>
          </label>
          <label>Run time (minutes)
            <input id="duration" type="number" min="1" step="1" inputmode="numeric" required>
          </label>
        </div>
        <p id="status" role="status"></p>
        <section id="result" aria-labelledby="result-label" hidden>
          <div class="window">
            <p id="result-label"></p>
            <h3 id="window"></h3>
          </div>
          <div class="metrics">
            <div class="metric"><strong id="coverage"></strong><span id="energy"></span></div>
            <div class="metric"><strong id="money"></strong><span id="money-label"></span></div>
          </div>
          <progress id="bar" max="1" aria-label="Forecast solar coverage"></progress>
          <p id="note"></p>
        </section>
      </ha-card>`;

    for (const id of ["power", "duration"]) {
      this.shadowRoot.getElementById(id).addEventListener("input", () => this._render());
    }
  }

  static getStubConfig() {
    return { entity: defaultEntity };
  }

  setConfig(config = {}) {
    const power = finite(config.default_power_kw ?? 2);
    const duration = finite(config.default_duration_minutes ?? 120);
    const maxAge = finite(config.max_plan_age_minutes ?? 20);
    if (!(power >= 0.1)) throw new Error("default_power_kw must be at least 0.1");
    if (!Number.isInteger(duration) || duration < 1) {
      throw new Error("default_duration_minutes must be a positive whole number");
    }
    if (!(maxAge > 0)) throw new Error("max_plan_age_minutes must be greater than zero");

    this._config = {
      entity: config.entity ?? defaultEntity,
      name: config.name ?? "Solar Headroom",
      maxAge: maxAge * minute,
    };
    this.shadowRoot.getElementById("power").value = power;
    this.shadowRoot.getElementById("duration").value = duration;
    this._render();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!this._config) return;
    const entity = this._config.entity;
    if (!previous || previous.language !== hass?.language ||
        previous.config?.time_zone !== hass?.config?.time_zone ||
        previous.states?.[entity] !== hass?.states?.[entity]) {
      this._render();
    }
  }

  connectedCallback() {
    this._timer = setInterval(() => this._render(), minute);
    this._render();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _render() {
    if (!this._config) return;
    const { entity, name, maxAge } = this._config;
    const get = (id) => this.shadowRoot.getElementById(id);
    const set = (id, value) => { get(id).textContent = value; };
    const state = this._hass?.states?.[entity];
    const plan = state?.attributes?.energy_plan;
    const now = Date.now();
    const generated = Date.parse(plan?.meta?.generated_at ?? plan?.summary?.ts);
    const power = finite(get("power").value);
    const minutes = finite(get("duration").value);

    set("title", name);
    const showStatus = (message) => {
      set("status", message);
      get("status").hidden = false;
      get("result").hidden = true;
    };

    if (!(power >= 0.1) || !Number.isInteger(minutes) || minutes < 1) {
      showStatus("Enter at least 0.1 kW and a whole number of minutes.");
      return;
    }
    if (!plan || state.state === "unavailable" || state.state === "unknown") {
      showStatus("Waiting for the Energy Manager plan.");
      return;
    }
    if (!Number.isFinite(generated) || now - generated > maxAge || generated - now > minute) {
      showStatus("Waiting for an up-to-date solar forecast.");
      return;
    }

    const earliest = Math.ceil(now / minute) * minute;
    const intervals = extractIntervals(plan.timeline, earliest);
    const best = bestWindow(intervals, earliest, minutes, power);
    if (!best) {
      showStatus("The forecast doesn’t contain a continuous window this long.");
      return;
    }
    const hasSolar = best.covered > energyTolerance;

    const locale = this._hass.language || undefined;
    const timeZone = this._hass.config?.time_zone;
    const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone });
    const day = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone });
    const from = clock.format(best.start);
    const to = clock.format(best.end);
    const date = day.format(best.start);
    const endDate = day.format(best.end);
    const startLabel = date === day.format(now) ? "Today" : date;
    const endLabel = date === endDate ? to : endDate + ", " + to;

    const fraction = best.covered / best.required;
    const displayedFraction = best.fullSolar ? 1 : Math.min(0.99, fraction);
    const percentage = new Intl.NumberFormat(locale, { style: "percent" });
    const energy = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    const amount = best.exportImpact;
    const cents = amount !== null ? Math.round(Math.abs(amount) * 100) : null;
    const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "AUD", currencyDisplay: "narrowSymbol" });

    get("status").hidden = true;
    const result = get("result");
    result.hidden = false;
    result.dataset.coverage = !hasSolar ? "none" : best.fullSolar ? "full" : "partial";
    set("result-label", !hasSolar ? "Solar coverage" :
      best.fullSolar ? "Best time to run on solar" : "Best partial-solar window");
    set("window", hasSolar ? startLabel + ", " + from + " – " + endLabel : "No excess solar forecast");
    set("coverage", percentage.format(displayedFraction));
    set("energy", energy.format(best.covered) + " of " + energy.format(best.required) + " kWh from solar");
    get("bar").value = fraction;

    set("money", cents === null ? "—" : currency.format(Math.abs(amount)));
    const tradeOff = amount > 0 ? "Feed-in credit forgone" : "Export charges avoided";
    set("money-label", cents === null ? "Feed-in price unavailable" : cents ? tradeOff : "Feed-in impact");
    if (!hasSolar) {
      set("note", "This load would rely on the battery or grid.");
    } else {
      set("note", best.fullSolar
        ? "Uses forecast surplus after house demand, EV and battery charging."
        : "No full-solar window found. The remaining load may draw from the battery or grid.");
    }
  }
}

if (!customElements.get(cardType)) {
  customElements.define(cardType, EmSolarHeadroomCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: cardType,
    name: "Solar Headroom",
    description: "Best forecast time to run an appliance on surplus solar.",
  });
}
