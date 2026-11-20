const defaultEntity = "sensor.energy_manager_plan";
const cardType = "em-battery-outlook-card";
const minute = 60000;
const solarThresholdKw = 0.05;
const socTolerance = 0.005;

function number(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) {
    return null;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function percent(value) {
  const result = number(value);
  return result !== null && result >= 0 && result <= 100 ? result : null;
}

function nonnegative(value) {
  const result = number(value);
  return result !== null && result >= 0 ? result : null;
}

function readTimeline(timeline, now) {
  if (!Array.isArray(timeline)) return [];

  const rows = timeline.map((row) => {
    const start = Date.parse(row?.ts);
    const duration = number(row?.interval_minutes);
    const startSoc = percent(row?.inputs?.soc_pct_start);
    const endSoc = percent(row?.expected?.soc_pct_end);
    if (!Number.isFinite(start) || !(duration > 0) || startSoc === null || endSoc === null) {
      return null;
    }
    return {
      start,
      end: start + duration * minute,
      startSoc,
      endSoc,
      minSoc: percent(row.constraints?.min_soc_pct),
      solarKw: nonnegative(row.inputs?.pv_kw),
      loadKw: nonnegative(row.inputs?.total_load_kw ?? row.inputs?.load_kw),
      importKw: nonnegative(row.expected?.grid_import_kw),
    };
  }).filter((row) => row && row.end > now).sort((a, b) => a.start - b.start);

  // The next planned interval can start a few minutes after the plan is generated.
  if (!rows.length || rows[0].start > now + 10 * minute) return [];

  const continuous = [rows[0]];
  for (const row of rows.slice(1)) {
    const previous = continuous.at(-1);
    if (row.start === previous.start) continue;
    if (row.start !== previous.end) break;
    continuous.push(row);
  }

  const first = continuous[0];
  if (first.start < now) {
    const elapsed = (now - first.start) / (first.end - first.start);
    first.startSoc += (first.endSoc - first.startSoc) * elapsed;
    first.start = now;
  }

  return continuous;
}

function getOvernight(rows) {
  const nightStart = rows.findIndex((row) => row.solarKw !== null && row.solarKw <= solarThresholdKw);
  if (nightStart < 0) return null;

  const night = [];
  let solarReturn = null;
  let low = 100;
  let minimumBy = null;
  for (const row of rows.slice(nightStart)) {
    if (row.solarKw === null || row.loadKw === null) break;
    if (row.solarKw > solarThresholdKw && row.solarKw >= row.loadKw) {
      solarReturn = row.start;
      break;
    }
    night.push(row);
    low = Math.min(low, row.startSoc, row.endSoc);
    if (minimumBy === null && row.minSoc !== null) {
      if (row.startSoc <= row.minSoc + socTolerance) minimumBy = row.start;
      else if (row.endSoc <= row.minSoc + socTolerance) minimumBy = row.end;
    }
  }
  if (!night.length) return null;

  const canTotalImport = solarReturn !== null && night.every((row) => row.importKw !== null);
  const gridKwh = canTotalImport
    ? night.reduce((sum, row) => sum + row.importKw * (row.end - row.start) / (60 * minute), 0)
    : null;

  return {
    low,
    minimumBy,
    solarReturn,
    gridKwh,
    hasMinimum: night.every((row) => row.minSoc !== null),
  };
}

class EmBatteryOutlookCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          container-type: inline-size;
          --outlook-text: var(--primary-text-color, #202329);
          --outlook-muted: var(--secondary-text-color, #636b74);
          --outlook-accent: var(--energy-battery-in-color, var(--primary-color, #008675));
          --outlook-line: var(--divider-color, #9aa1a6);
          color: var(--outlook-text);
        }
        [hidden] { display: none !important; }
        .body { padding: 16px; }
        header {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px 8px;
          margin-bottom: 12px;
        }
        ha-icon { --mdc-icon-size: 20px; color: var(--outlook-accent); }
        h2, p { margin: 0; }
        h2 { font-size: 16px; font-weight: 600; }
        .forecast {
          margin-left: auto;
          color: var(--outlook-muted);
          font-size: 11px;
        }
        .headline { font-size: 14px; font-weight: 600; }
        .metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin: 12px 0;
        }
        .metric {
          min-width: 0;
          padding: 8px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--outlook-muted) 9%, transparent);
        }
        strong {
          display: block;
          font-size: 18px;
          line-height: 1.2;
          font-variant-numeric: tabular-nums;
        }
        .label, .chart-time, .message {
          color: var(--outlook-muted);
          font-size: 11px;
          line-height: 1.35;
        }
        .label { display: block; margin-top: 3px; }
        .chart-time { display: flex; justify-content: space-between; gap: 8px; }
        .chart-time span:last-child { text-align: right; }
        .message { font-size: 13px; }
        canvas { display: block; width: 100%; height: 72px; }
        @container (max-width: 245px) {
          .body { padding: 12px; }
          .metric { padding: 6px; }
          .metrics { gap: 5px; }
          strong { font-size: 15px; overflow-wrap: anywhere; }
        }
      </style>
      <ha-card>
        <div class="body">
          <header>
            <ha-icon icon="mdi:battery-clock-outline" aria-hidden="true"></ha-icon>
            <h2 id="title"></h2>
            <span class="forecast" id="forecast" hidden>Forecast</span>
          </header>
          <p class="message" id="message" role="status"></p>
          <section id="outlook" aria-labelledby="title" hidden>
            <p class="headline" id="headline"></p>
            <div class="metrics">
              <div class="metric"><strong id="soc"></strong><span class="label" id="soc-label"></span></div>
              <div class="metric"><strong id="low"></strong><span class="label" id="low-label"></span></div>
              <div class="metric">
                <strong id="extra"></strong><span class="label" id="extra-label"></span>
              </div>
            </div>
            <canvas role="img"></canvas>
            <div class="chart-time"><span id="start-time"></span><span id="end-time"></span></div>
          </section>
        </div>
      </ha-card>`;
    this._canvas = this.shadowRoot.querySelector("canvas");
    this._resizeObserver = new ResizeObserver(() => this._drawChart());
  }

  static getStubConfig() {
    return { entity: defaultEntity };
  }

  setConfig(config) {
    const maxAge = number(config.max_plan_age_minutes ?? 20);
    const capacity = number(config.battery_capacity_kwh);
    if (!(maxAge > 0)) throw new Error("max_plan_age_minutes must be greater than zero");
    if (config.battery_capacity_kwh != null && !(capacity > 0)) {
      throw new Error("battery_capacity_kwh must be greater than zero");
    }
    this._config = {
      entity: config.entity ?? defaultEntity,
      name: config.name ?? "Battery Outlook",
      socEntity: config.soc_entity,
      capacityEntity: config.battery_capacity_entity,
      capacity,
      maxAge,
    };
    this._render();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!this._config) return;
    const { entity, socEntity, capacityEntity } = this._config;
    if (!previous || previous.language !== hass.language || previous.themes !== hass.themes ||
        previous.config?.time_zone !== hass.config?.time_zone ||
        [entity, socEntity, capacityEntity].some((id) => id && previous.states[id] !== hass.states[id])) {
      this._render();
    }
  }

  connectedCallback() {
    this._resizeObserver.observe(this._canvas);
    this._timer = setInterval(() => this._render(), minute);
    this._render();
  }

  disconnectedCallback() {
    this._resizeObserver.disconnect();
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
    const byId = (id) => this.shadowRoot.getElementById(id);
    const set = (id, text) => { byId(id).textContent = text; };
    const { entity, name, socEntity, capacityEntity, capacity, maxAge } = this._config;
    const hass = this._hass;
    const state = hass?.states[entity];
    const plan = state?.attributes?.energy_plan;
    const generated = Date.parse(plan?.meta?.generated_at ?? plan?.summary?.ts);
    const now = Date.now();
    const showMessage = (message) => {
      byId("forecast").hidden = true;
      byId("outlook").hidden = true;
      byId("message").hidden = false;
      set("message", message);
      this._rows = [];
    };

    set("title", name);
    if (!plan || state.state === "unavailable" || state.state === "unknown") {
      showMessage("Waiting for the Energy Manager plan.");
      return;
    }
    if (!Number.isFinite(generated) || generated < now - maxAge * minute) {
      showMessage("Waiting for a fresh battery forecast.");
      return;
    }
    const rows = readTimeline(plan.timeline, now);
    if (!rows.length) {
      showMessage("No upcoming battery forecast is available.");
      return;
    }

    const timeZone = hass.config?.time_zone;
    const locale = hass.language || undefined;
    const clock = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone });
    const day = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone });
    const date = new Intl.DateTimeFormat(locale, { year: "numeric", month: "numeric", day: "numeric", timeZone });
    const time = (timestamp) => {
      const label = clock.format(timestamp);
      return date.format(timestamp) === date.format(now) ? label : day.format(timestamp) + " " + label;
    };
    const socFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const energyFormat = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const formatSoc = (value) => socFormat.format(value) + "%";
    const formatEnergy = (value) => energyFormat.format(value) + " kWh";

    const liveSoc = socEntity ? percent(hass.states[socEntity]?.state) : null;
    const planSoc = percent(plan.summary?.now_soc_pct);
    const currentSoc = liveSoc ?? planSoc;
    const capacityKwh = (capacityEntity ? number(hass.states[capacityEntity]?.state) : null);
    const effectiveCapacity = capacityKwh > 0 ? capacityKwh : capacity;
    const first = rows[0];
    const last = rows.at(-1);
    const aboveMin = currentSoc !== null && first.minSoc !== null && effectiveCapacity > 0
      ? effectiveCapacity * Math.max(0, currentSoc - first.minSoc) / 100
      : null;
    const overnight = getOvernight(rows);
    const fullForecastLow = Math.min(...rows.flatMap((row) => [row.startSoc, row.endSoc]));

    let headline = "Projected battery level through " + time(last.end) + ".";
    if (overnight?.minimumBy != null) {
      headline = "Battery at minimum by " + time(overnight.minimumBy) + ".";
    } else if (overnight?.solarReturn != null) {
      if (overnight.hasMinimum) {
        headline = "Expected to stay above minimum until solar covers demand.";
      } else {
        headline = "Solar expected to cover demand by " + time(overnight.solarReturn) + ".";
      }
    } else if (overnight) {
      headline = "The plan does not show solar covering demand after dark.";
    }

    const isCompleteNight = overnight?.solarReturn != null;
    const gridKwh = overnight?.gridKwh ?? null;
    set("headline", headline);
    set("soc", aboveMin !== null ? formatEnergy(aboveMin) : formatSoc(currentSoc ?? first.startSoc));
    let socLabel = planSoc !== null ? "SoC at plan update" : "SoC at forecast start";
    if (liveSoc !== null) socLabel = "Current SoC";
    if (aboveMin !== null) socLabel = "Above battery minimum";
    set("soc-label", socLabel);
    set("low", formatSoc(isCompleteNight ? overnight.low : fullForecastLow));
    set("low-label", isCompleteNight ? "Overnight low" : "Forecast low");
    set("extra", gridKwh !== null ? formatEnergy(gridKwh) : formatSoc(last.endSoc));
    set("extra-label", gridKwh !== null ? "Grid before solar covers demand" : "SoC at forecast end");
    set("start-time", time(first.start));
    set("end-time", time(last.end));
    this._canvas.setAttribute("aria-label",
      "Forecast battery state of charge from " + formatSoc(first.startSoc) + " to " +
      formatSoc(last.endSoc) + ", with a low of " + formatSoc(fullForecastLow) + ".");

    this._rows = rows;
    byId("forecast").hidden = false;
    byId("message").hidden = true;
    byId("outlook").hidden = false;
    this._drawChart();
  }

  _drawChart() {
    const rows = this._rows;
    const canvas = this._canvas;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!rows?.length || !width || !height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(canvas.width / width, canvas.height / height);
    const style = getComputedStyle(canvas);
    const accent = style.getPropertyValue("--outlook-accent").trim();
    const line = style.getPropertyValue("--outlook-line").trim();
    const first = rows[0];
    const last = rows.at(-1);
    const x = (ts) => 2 + (width - 4) * (ts - first.start) / (last.end - first.start);
    const y = (soc) => 3 + (height - 6) * (1 - soc / 100);

    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const level of [0, 50, 100]) {
      ctx.moveTo(2, y(level));
      ctx.lineTo(width - 2, y(level));
    }
    ctx.stroke();

    const trace = () => {
      ctx.moveTo(x(first.start), y(first.startSoc));
      for (const row of rows) ctx.lineTo(x(row.end), y(row.endSoc));
    };
    ctx.beginPath();
    trace();
    ctx.lineTo(x(last.end), y(0));
    ctx.lineTo(x(first.start), y(0));
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.13;
    ctx.fill();

    ctx.beginPath();
    trace();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

if (!customElements.get(cardType)) {
  customElements.define(cardType, EmBatteryOutlookCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: cardType,
    name: "Battery Outlook",
    description: "Projected battery level, overnight minimum and grid import.",
  });
}
