const cardType = "em-daily-plan-recap-card";
const recapEntity = "sensor.em_daily_plan_recap";

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildRecap(record, formats) {
  const planned = number(record.expected_export_kwh);
  const measured = number(record.observed_export_kwh);
  const target = number(record.target_soc_pct);
  const openingSoc = number(record.opening_soc_pct);
  const reserve = number(record.reserve_soc_pct);
  const observedAt = number(record.reserve_observed_at);
  const expectedStart = number(record.planned_reserve?.start);
  const expectedEnd = number(record.planned_reserve?.end);
  const notes = [];
  const pct = (value) => formats.percent.format(value) + "%";
  const formatTime = (value) => formats.time.format(value * 1000);
  const kwh = (value) => formats.energy.format(value) + " kWh";
  let headline = "Export comparison unavailable for this window.";
  if (planned !== null && measured !== null) {
    const delta = Number((measured - planned).toFixed(1));
    if (delta === 0) headline = "Grid export was in line with the plan.";
    else headline = "You exported " + kwh(Math.abs(delta)) +
      (delta > 0 ? " more than planned." : " less than planned.");
  }
  if (planned === null) notes.push("No complete forecast was available when the window opened.");
  if (measured === null) notes.push("The export meter data for this window was incomplete.");

  if (target !== null && openingSoc !== null) {
    if (openingSoc >= target) {
      notes.push("The battery was at or above its " + pct(target) + " target when the window opened.");
    } else {
      notes.push("The battery was at " + pct(openingSoc) + " when the window opened, below its " +
        pct(target) + " target.");
    }
  }

  if (reserve !== null && observedAt !== null) {
    if (observedAt === record.start) {
      notes.push("The battery was already at or below its " + pct(reserve) + " reserve when the window opened.");
    } else {
      let line = "The battery was first recorded at or below its " + pct(reserve) +
        " reserve at " + formatTime(observedAt);
      if (expectedStart !== null && expectedEnd !== null && !record.soc_has_gap) {
        if (observedAt < expectedStart) {
          const minutes = Math.round((expectedStart - observedAt) / 60);
          line += minutes > 0 ? ", " + minutes + (minutes === 1 ? " minute" : " minutes") +
            " before the forecast interval" : ", before the forecast interval";
        } else if (observedAt > expectedEnd) {
          line += ", after the forecast interval";
        } else {
          line += ", within the forecast interval";
        }
        if (expectedStart !== expectedEnd) {
          line += " (" + formatTime(expectedStart) + " – " + formatTime(expectedEnd) + ")";
        } else {
          line += " (planned by " + formatTime(expectedEnd) + ")";
        }
      }
      notes.push(line + ".");
    }
  } else if (reserve !== null && record.window_complete && !record.soc_has_gap &&
             record.planned_reserve_known && expectedStart !== null) {
    notes.push("The plan expected the battery to reach its " + pct(reserve) +
      " reserve, but the recorded readings stayed above it during the window.");
  }

  return { headline, notes, planned: planned === null ? "—" : kwh(planned),
    measured: measured === null ? "—" : kwh(measured) };
}

class EmDailyPlanRecapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          --recap-muted: var(--secondary-text-color, #626974);
          --recap-accent: var(--primary-color, #037b70);
          color: var(--primary-text-color, #202329);
          padding: 16px;
        }
        [hidden] { display: none !important; }
        h2, p { margin: 0; }
        header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        h2 { font-size: 16px; line-height: 1.25; font-weight: 600; }
        ha-icon { --mdc-icon-size: 20px; color: var(--recap-accent); }
        #period, #status, .metric span { font-size: 12px; color: var(--recap-muted); line-height: 1.35; }
        #headline { font-size: 15px; font-weight: 600; line-height: 1.35; margin-top: 4px; }
        .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
        .metric { padding: 8px; border-radius: 8px; min-width: 0;
          background: color-mix(in srgb, var(--recap-muted) 9%, transparent); }
        .metric strong { display: block; font-size: 18px; font-variant-numeric: tabular-nums; }
        .metric span { display: block; margin-top: 3px; }
        ul { margin: 0; padding-left: 17px; font-size: 13px; line-height: 1.45; }
        li + li { margin-top: 5px; }
        #status { margin-top: 8px; }
      </style>
      <ha-card>
        <header>
          <ha-icon icon="mdi:clipboard-text-clock-outline" aria-hidden="true"></ha-icon>
          <h2 id="title"></h2>
        </header>
        <section id="result" aria-labelledby="headline" hidden>
          <p id="period"></p>
          <p id="headline"></p>
          <div class="metrics">
            <div class="metric"><strong id="measured"></strong><span>Measured export</span></div>
            <div class="metric"><strong id="planned"></strong><span>Planned export</span></div>
          </div>
          <ul id="notes" aria-label="Battery and data notes" hidden></ul>
        </section>
        <p id="status" role="status"></p>
      </ha-card>`;
  }

  static getStubConfig() { return { entity: recapEntity }; }

  setConfig(config = {}) {
    this._config = { entity: config.entity ?? recapEntity, name: config.name ?? "Daily Plan Recap" };
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
    const { entity, name } = this._config;
    const get = (id) => this.shadowRoot.getElementById(id);
    const set = (id, value) => { get(id).textContent = value; };
    const state = this._hass?.states?.[entity];
    const capture = state?.attributes?.capture;
    const record = capture?.latest;
    set("title", name);
    const hasRecord = number(record?.start) !== null && number(record?.end) !== null;
    get("result").hidden = !hasRecord;

    let status = capture?.issue || "";
    if (!status && (!state || state.state === "unavailable" || state.state === "unknown")) {
      status = "Waiting for the daily recap sensor.";
    } else if (!status && capture?.active) {
      status = hasRecord ? "Today’s window is in progress. Showing the previous recap." :
        "The export window is in progress. The recap will appear once it ends.";
    } else if (!status && !hasRecord) {
      status = "The recap will appear after the first captured window.";
    }

    set("status", status);
    get("status").hidden = !status;
    if (!hasRecord) return;

    const locale = this._hass.language || undefined;
    const timeZone = this._hass.config?.time_zone;
    const formats = {
      time: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }),
      energy: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      percent: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    };
    const date = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short",
      year: "numeric", timeZone });
    const start = record.start * 1000;
    const end = record.end * 1000;
    set("period", date.format(start) + " · " + formats.time.format(start) + " – " + formats.time.format(end));
    const recap = buildRecap(record, formats);
    for (const id of ["headline", "measured", "planned"]) set(id, recap[id]);
    const notes = get("notes");
    notes.hidden = recap.notes.length === 0;
    notes.replaceChildren(...recap.notes.map((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      return item;
    }));
  }
}

if (!customElements.get(cardType)) {
  customElements.define(cardType, EmDailyPlanRecapCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: cardType, name: "Daily Plan Recap",
    description: "Compare the saved plan with the outcome of the daily export window.",
  });
}
