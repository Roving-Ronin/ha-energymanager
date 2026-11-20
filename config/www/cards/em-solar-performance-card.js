const cardType = "em-solar-performance-card";
const defaultEntity = "sensor.em_solar_performance";
const dayMs = 86400000;
const windowDays = 30;
const reasons = {
  curtailed: "Curtailment",
  downtime: "Inverter downtime",
  meter_gap: "PV meter or recording gap",
  meter_reset: "PV meter reset",
  forecast_missing: "Morning forecast missing",
  forecast_zero: "Morning forecast was zero",
  daylight_unknown: "Daylight status unavailable",
  curtailment_unknown: "Curtailment status unavailable",
  downtime_unknown: "Inverter status unavailable",
};

function energy(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function lastCompletedDays(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone,
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const midnight = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
  return Array.from({ length: windowDays }, (_, index) =>
    new Date(midnight - (windowDays - index) * dayMs).toISOString().slice(0, 10));
}

function compare(dates, records) {
  const byDate = new Map((Array.isArray(records) ? records : []).filter(Boolean)
    .map(record => [record.date, record]));
  const days = dates.map(date => {
    const record = byDate.get(date);
    const forecast = energy(record?.forecast_kwh);
    const actual = energy(record?.actual_kwh);
    const flags = Array.isArray(record?.flags) ? record.flags : [];
    const comparable = forecast > 0 && actual !== null && flags.length === 0;
    const explanation = [];
    if (!record) explanation.push("No daily record");
    else {
      for (const flag of flags) explanation.push(reasons[flag] ?? "Quality flag");
      if (forecast === null && !flags.includes("forecast_missing")) explanation.push("Forecast unavailable");
      if (forecast === 0 && !flags.includes("forecast_zero")) explanation.push("Morning forecast was zero");
      if (actual === null && !flags.includes("meter_gap") && !flags.includes("meter_reset")) {
        explanation.push("Measured PV unavailable");
      }
    }
    return { date, forecast, actual, comparable, explanation, downtimeChecked: record?.downtime_checked === true };
  });

  const comparable = days.filter(day => day.comparable);
  const forecastTotal = comparable.reduce((total, day) => total + day.forecast, 0);
  const actualTotal = comparable.reduce((total, day) => total + day.actual, 0);
  return {
    days, count: comparable.length,
    bias: forecastTotal > 0 ? (actualTotal - forecastTotal) / forecastTotal : null,
    downtimeChecked: comparable.every(day => day.downtimeChecked),
  };
}

class EmSolarPerformanceCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          --forecast-color: var(--primary-color, #3389c5);
          --actual-color: var(--energy-solar-color, #d88f18);
          --muted: var(--secondary-text-color, #646970);
          color: var(--primary-text-color, #202329);
          padding: 16px;
        }
        [hidden] { display: none !important; }
        h2, p { margin: 0; }
        header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        h2 { font-size: 16px; font-weight: 600; }
        ha-icon { --mdc-icon-size: 20px; color: var(--actual-color); }
        #summary { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
        #status, #coverage, #quality, #scale, #range, .legend, summary, th, td {
          color: var(--muted); font-size: 12px; line-height: 1.4;
        }
        #quality { margin-top: 4px; }
        .legend { display: flex; gap: 8px 14px; flex-wrap: wrap; margin-top: 14px; }
        .legend span { display: inline-flex; align-items: center; gap: 5px; }
        .legend i { width: 8px; height: 8px; border-radius: 2px; background: var(--swatch); }
        .forecast { --swatch: var(--forecast-color); }
        .actual { --swatch: var(--actual-color); }
        .legend .excluded { --swatch: var(--muted); }
        .axis { display: flex; justify-content: space-between; gap: 6px; margin: 5px 0 0; }
        #chart {
          display: grid; grid-template-columns: repeat(30, minmax(0, 1fr));
          gap: 2px; height: 76px; align-items: stretch;
          border-bottom: 1px solid var(--divider-color, #8886);
        }
        .day { display: flex; align-items: flex-end; gap: 1px; position: relative; }
        .day.excluded .bar { opacity: .4; }
        .day.excluded::after {
          content: ""; position: absolute; bottom: -4px; width: 100%; height: 2px;
          background: var(--muted);
        }
        .day.empty::after { opacity: .35; }
        .bar { flex: 1; background: var(--swatch); border-radius: 1px 1px 0 0; }
        details { margin-top: 12px; }
        summary { cursor: pointer; }
        .table-wrap { overflow-x: auto; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 4px 5px; vertical-align: top; }
        th[scope="row"] { font-weight: 500; white-space: nowrap; }
        td:nth-child(2), td:nth-child(3) { white-space: nowrap; }
      </style>
      <ha-card>
        <header><ha-icon icon="mdi:solar-power-variant" aria-hidden="true"></ha-icon><h2 id="title"></h2></header>
        <p id="status" role="status"></p>
        <section id="result" hidden aria-labelledby="title">
          <p id="summary"></p>
          <p id="coverage"></p>
          <p id="quality" hidden></p>
          <div class="legend" aria-hidden="true">
            <span class="forecast"><i></i>Solcast</span>
            <span class="actual"><i></i>Measured PV</span>
            <span class="excluded"><i></i>Excluded day</span>
          </div>
          <div class="axis" aria-hidden="true"><span id="scale"></span></div>
          <div id="chart" aria-hidden="true"></div>
          <div class="axis" id="range" aria-hidden="true"></div>
          <details>
            <summary>Daily values and exclusions</summary>
            <div class="table-wrap">
              <table aria-label="Daily solar production in kWh">
                <thead><tr><th scope="col">Day</th><th scope="col">Forecast</th><th scope="col">Actual</th><th scope="col">Comparison</th></tr></thead>
                <tbody id="table"></tbody>
              </table>
            </div>
          </details>
        </section>
      </ha-card>`;
  }

  static getStubConfig() { return { entity: defaultEntity }; }

  setConfig(config = {}) {
    this._config = { entity: config.entity ?? defaultEntity,
      name: config.name ?? config.title ?? "Solar Performance" };
    this._render();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!this._config) return;
    const { entity } = this._config;
    if (!previous || previous.states?.[entity] !== hass?.states?.[entity] ||
        previous.language !== hass?.language || previous.config?.time_zone !== hass?.config?.time_zone) {
      this._render();
    }
  }

  getCardSize() { return 3; }

  getGridOptions() { return { columns: 12, min_columns: 6 }; }

  _render() {
    if (!this._config) return;
    const get = id => this.shadowRoot.getElementById(id);
    const set = (id, value) => { get(id).textContent = value; };
    const { entity, name } = this._config;
    const state = this._hass?.states?.[entity];
    const records = state?.attributes?.comparison?.days;
    set("title", name);
    const available = state && !["unknown", "unavailable"].includes(state.state);
    const hasRecords = available && Array.isArray(records) && records.length > 0;
    get("status").hidden = hasRecords;
    get("result").hidden = !hasRecords;
    if (!hasRecords) {
      set("status", available ? "The first daily comparison appears after midnight." :
        "Waiting for the Solar Performance sensor.");
      return;
    }

    const timeZone = this._hass.config?.time_zone;
    const locale = this._hass.language || undefined;
    const { days, count, bias, downtimeChecked } = compare(lastCompletedDays(Date.now(), timeZone), records);
    const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
    const kwh = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const dateFormat = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
    const dateLabel = date => dateFormat.format(new Date(date + "T00:00:00Z"));
    const valueLabel = value => value === null ? "—" : kwh.format(value) + " kWh";

    if (bias === null) set("summary", "No comparable days yet");
    else if (Math.abs(bias) < 0.0005) set("summary", "Measured solar was in line with the forecast");
    else set("summary", "Measured solar was " + percent.format(Math.abs(bias)) +
      (bias < 0 ? " below" : " above") + " forecast in total");
    set("coverage", count + " of the last 30 completed days included");
    get("quality").hidden = !count || downtimeChecked;
    set("quality", "Inverter downtime wasn’t monitored on all included days.");

    const max = Math.max(1, ...days.flatMap(day => [day.forecast ?? 0, day.actual ?? 0]));
    const step = 10 ** Math.floor(Math.log10(max));
    const upper = Math.ceil(max / step) * step;
    set("scale", kwh.format(upper) + " kWh");
    set("range", dateLabel(days[0].date) + " – " + dateLabel(days.at(-1).date));

    const chartDays = [];
    const tableRows = [];
    for (const day of days) {
      const group = document.createElement("div");
      group.className = "day" + (day.comparable ? "" : " excluded") +
        (day.forecast === null && day.actual === null ? " empty" : "");
      const detail = day.comparable ? "Included" : day.explanation.join(", ");
      for (const [className, value] of [["forecast", day.forecast], ["actual", day.actual]]) {
        const bar = document.createElement("div");
        bar.className = "bar " + className;
        bar.style.height = (value ?? 0) / upper * 100 + "%";
        group.append(bar);
      }
      group.title = dateLabel(day.date) + " · Forecast " + valueLabel(day.forecast) +
        " · Actual " + valueLabel(day.actual) + " · " + detail;
      chartDays.push(group);

      const row = document.createElement("tr");
      const dayHeader = document.createElement("th");
      dayHeader.scope = "row";
      dayHeader.textContent = dateLabel(day.date);
      row.append(dayHeader);
      for (const value of [valueLabel(day.forecast), valueLabel(day.actual), detail]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      tableRows.unshift(row);
    }
    get("chart").replaceChildren(...chartDays);
    get("table").replaceChildren(...tableRows);
  }
}

if (!customElements.get(cardType)) {
  customElements.define(cardType, EmSolarPerformanceCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: cardType, name: "Solar Performance",
    description: "Compare the morning Solcast forecast with measured PV over 30 days." });
}
