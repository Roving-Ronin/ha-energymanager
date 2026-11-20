const cardType = "em-system-limits-card";
const planEntity = "sensor.energy_manager_plan";
const minute = 60000;
const socTolerance = 0.1;

function nonnegative(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function percent(value) {
  const result = nonnegative(value);
  return result !== null && result <= 100 ? result : null;
}

function getPlanIntervals(plan, now) {
  let current = null;
  let next = null;
  const timeline = Array.isArray(plan.timeline) ? plan.timeline : [];
  for (const row of timeline) {
    const start = Date.parse(row?.ts);
    const duration = nonnegative(row?.interval_minutes);
    if (!Number.isFinite(start) || !(duration > 0)) continue;
    if (start <= now && now < start + duration * minute && (!current || start > current.start)) {
      current = { row, start };
    } else if (start > now && (!next || start < next.start)) {
      next = { row, start };
    }
  }
  return { current, next };
}

function getSnapshot(blocks, code) {
  if (!Array.isArray(blocks)) return {};
  return blocks.find((block) => block?.code === code && block.authoritative === true)?.data ?? {};
}

function liveExportKw(state, now, maxAge) {
  const updatedAt = Date.parse(state?.last_reported ?? state?.last_updated);
  if (!Number.isFinite(updatedAt) || now - updatedAt > maxAge) return null;
  const power = nonnegative(state.state);
  if (power === null) return null;
  const unit = state.attributes?.unit_of_measurement;
  if (unit === "W") return power / 1000;
  return unit === "kW" ? power : null;
}

function describeLimits(attributes, liveSoc, exportKw, now, format) {
  const { energy_plan: plan, blocks_summary: summary = {}, blocks } = attributes;
  const mode = getSnapshot(blocks, "mode_snapshot");
  const tariff = getSnapshot(blocks, "tariff_snapshot");
  const { current, next } = getPlanIntervals(plan, now);
  const interval = current ?? next;
  const caps = interval?.row.setpoints ?? {};
  const soc = liveSoc ?? percent(plan.summary?.now_soc_pct);
  const currentMaxSoc = percent(current?.row.constraints?.max_soc_pct);
  const hardMinSoc = percent(current?.row.constraints?.min_soc_pct);

  const limits = [];
  const add = (icon, title, detail) => limits.push({ icon, title, detail });
  const kw = (value) => format(value) + " kW";
  const pct = (value) => format(value) + "%";
  const capInWatts = (value) => {
    const watts = nonnegative(value);
    return watts === null ? "" : "Plan limit " + kw(watts / 1000);
  };

  if (summary?.curtail_active === true) {
    const value = percent(summary.curtail_pct);
    add("mdi:solar-power-variant", "Solar curtailment active",
      value === null ? "" : "Curtailment setting " + pct(value));
  }

  if ((mode.battery_discharge_restriction_active ?? tariff.battery_discharge_restriction_active) === true) {
    add("mdi:battery-arrow-down-outline", "Battery discharge restricted",
      capInWatts(mode.battery_discharge_restriction_limit_w ?? tariff.battery_discharge_restriction_limit_w));
  }

  if (soc !== null && hardMinSoc !== null && soc <= hardMinSoc + socTolerance) {
    add("mdi:battery-low", "Battery at minimum charge",
      "Battery level " + pct(soc) + " · Minimum " + pct(hardMinSoc));
  } else if (soc !== null && currentMaxSoc !== null && soc >= currentMaxSoc - socTolerance) {
    add("mdi:battery-high", "Battery at charge target", "Target " + pct(currentMaxSoc));
  } else if (soc === 100) {
    add("mdi:battery-high", "Battery full", "Battery level 100%");
  }

  if (mode.preserve_battery === true) {
    const reserve = percent(mode.effective_battery_reserve_pct);
    add("mdi:battery-lock-outline", "Battery energy being preserved",
      reserve === null ? "" : "Plan reserve " + pct(reserve));
  } else if ((mode.dynamic_reserve_active ?? tariff.dynamic_reserve_active) === true) {
    const reserve = percent(mode.dynamic_reserve_pct ?? tariff.dynamic_reserve_pct);
    add("mdi:battery-lock-outline", "Dynamic battery reserve active",
      reserve === null ? "" : "Plan reserve " + pct(reserve));
  }

  if ((mode.solar_overflow_headroom_delaying ?? tariff.solar_overflow_headroom_delaying) === true) {
    add("mdi:weather-sunny", "Charging delayed to leave room for solar",
      capInWatts(mode.effective_charge_limit_w ?? tariff.effective_charge_limit_w));
  } else if (tariff.scheduled_charge_holding === true) {
    add("mdi:clock-outline", "Scheduled charging on hold", "");
  } else if (tariff.dynamic_charge_active === true) {
    add("mdi:battery-charging-outline", "Dynamic charging limit active",
      capInWatts(mode.effective_charge_limit_w ?? tariff.effective_charge_limit_w));
  }

  if ((summary?.weather_restrict ?? plan.summary?.weather_restrict) === true) {
    add("mdi:weather-pouring", "Bad weather restrictions active", "");
  }

  const exportCap = nonnegative(current?.row.setpoints?.export_limit_kw);
  if (exportKw !== null && exportCap > 0 && Math.abs(exportKw - exportCap) <= exportCap * 0.02) {
    add("mdi:transmission-tower-export", "Grid export near the planned cap",
      "Measured " + kw(exportKw) + " · Plan cap " + kw(exportCap));
  }

  const details = [
    ["Grid export", caps.export_limit_kw, kw],
    ["Grid import", caps.import_limit_kw, kw],
    ["Battery charge", caps.charge_limit_kw, kw],
    ["Battery discharge", caps.discharge_limit_kw, kw],
    ["Battery minimum", interval?.row.constraints?.min_soc_pct, pct],
  ].flatMap(([label, raw, formatValue]) => {
    const value = nonnegative(raw);
    return value === null ? [] : [[label, formatValue(value)]];
  });

  return { limits, details, detailsTitle: current ? "Current plan setpoints" : "Next interval setpoints" };
}

class EmSystemLimitsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          --limit-muted: var(--secondary-text-color, #626974);
          --limit-accent: var(--primary-color, #037b70);
          --limit-border: var(--divider-color, #d9dde2);
          color: var(--primary-text-color, #202329);
          padding: 16px;
        }
        [hidden] { display: none !important; }
        header, li { display: flex; align-items: flex-start; gap: 10px; }
        header { align-items: center; margin-bottom: 12px; }
        h2, p { margin: 0; }
        h2 { font-size: 16px; line-height: 1.25; font-weight: 600; }
        ha-icon { --mdc-icon-size: 20px; color: var(--limit-accent); flex: none; }
        ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
        li {
          padding: 9px 10px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--limit-accent) 9%, transparent);
        }
        li strong { display: block; font-size: 13px; line-height: 1.35; }
        li p { margin-top: 2px; }
        li p, #status, summary, dt { color: var(--limit-muted); font-size: 12px; }
        #status { line-height: 1.4; }
        details { margin-top: 11px; border-top: 1px solid var(--limit-border); padding-top: 9px; }
        summary { cursor: pointer; }
        dl { display: grid; gap: 6px 10px; grid-template-columns: minmax(0, 1fr) auto; margin: 10px 0 0; }
        dd { margin: 0; font-size: 12px; font-variant-numeric: tabular-nums; }
      </style>
      <ha-card>
        <header>
          <ha-icon icon="mdi:speedometer" aria-hidden="true"></ha-icon>
          <h2 id="title"></h2>
        </header>
        <p id="status" role="status"></p>
        <ul id="limits" aria-label="Reported limits"></ul>
        <details id="setpoints" hidden>
          <summary></summary>
          <dl></dl>
        </details>
      </ha-card>`;
  }

  static getStubConfig() {
    return { entity: planEntity };
  }

  setConfig(config) {
    const maxAge = nonnegative(config.max_plan_age_minutes ?? 20);
    if (!(maxAge > 0)) throw new Error("max_plan_age_minutes must be greater than zero");
    this._config = {
      entity: config.entity ?? planEntity,
      name: config.name ?? "What’s limiting my system?",
      socEntity: config.soc_entity,
      exportEntity: config.grid_export_entity,
      maxAge: maxAge * minute,
    };
    this._render();
  }

  set hass(hass) {
    const previous = this._hass;
    this._hass = hass;
    if (!this._config) return;
    const { entity, socEntity, exportEntity } = this._config;
    if (!previous || previous.language !== hass.language ||
        [entity, socEntity, exportEntity].some((id) => id && previous.states[id] !== hass.states[id])) {
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
    return 2;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _render() {
    if (!this._config) return;
    const root = this.shadowRoot;
    const { entity, name, maxAge, socEntity, exportEntity } = this._config;
    const state = this._hass?.states[entity];
    const attributes = state?.attributes;
    const plan = attributes?.energy_plan;
    const now = Date.now();
    const generated = Date.parse(plan?.meta?.generated_at ?? plan?.summary?.ts ?? attributes?.blocks_summary?.ts);
    const status = root.getElementById("status");
    const list = root.getElementById("limits");
    const detailsElement = root.getElementById("setpoints");
    root.getElementById("title").textContent = name;

    let message = "";
    let limits = [];
    let details = [];
    let detailsTitle = "";
    if (!plan || state.state === "unknown" || state.state === "unavailable") {
      message = "Waiting for the Energy Manager plan.";
    } else if (!Number.isFinite(generated) || now - generated > maxAge || generated - now > minute) {
      message = "Waiting for an up-to-date Energy Manager plan.";
    } else {
      const liveSoc = percent(this._hass.states[socEntity]?.state);
      const exportKw = liveExportKw(this._hass.states[exportEntity], now, 5 * minute);
      const format = new Intl.NumberFormat(this._hass.language || undefined, { maximumFractionDigits: 2 });
      ({ limits, details, detailsTitle } = describeLimits(
        attributes, liveSoc, exportKw, now, (value) => format.format(value)));
      if (!limits.length) message = "No active limits reported by the current plan.";
    }

    status.textContent = message;
    status.hidden = !message;
    list.hidden = !limits.length;
    list.replaceChildren(...limits.map(({ icon, title, detail }) => {
      const item = document.createElement("li");
      const symbol = document.createElement("ha-icon");
      symbol.setAttribute("icon", icon);
      symbol.setAttribute("aria-hidden", "true");
      const content = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = title;
      content.append(label);
      if (detail) {
        const description = document.createElement("p");
        description.textContent = detail;
        content.append(description);
      }
      item.append(symbol, content);
      return item;
    }));

    detailsElement.hidden = !details.length;
    detailsElement.querySelector("summary").textContent = detailsTitle;
    detailsElement.querySelector("dl").replaceChildren(...details.flatMap(([label, value]) => {
      const term = document.createElement("dt");
      const definition = document.createElement("dd");
      term.textContent = label;
      definition.textContent = value;
      return [term, definition];
    }));
  }
}

if (!customElements.get(cardType)) {
  customElements.define(cardType, EmSystemLimitsCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: cardType,
    name: "What’s limiting my system?",
    description: "Active Energy Manager limits and current plan setpoints.",
  });
}
