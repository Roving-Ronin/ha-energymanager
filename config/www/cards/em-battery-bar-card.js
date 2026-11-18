class EMBatteryBarCard extends HTMLElement {
  setConfig(config) {
    if (!config.entity) {
      throw new Error("Battery SOC entity is required");
    }

    this.config = {
      title: "Battery Level",
      segments: 27,
      height: 40,
      ...config
    };

    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          min-width: 0;
        }

        ha-card {
          display: block;
          width: 100%;
          box-sizing: border-box;
          padding: 14px;
        }
        .title {
          font-size: 22px;
          margin-bottom: 8px;
          color: var(--primary-text-color);
        }
        .display {
          display: flex;
          align-items: center;
          gap: 18px;
          width: 100%;
          min-width: 0;
        }
        .segments {
          display: flex;
          flex: 1 1 0%;
          width: 100%;
          min-width: 0;
          gap: 3px;
        }
        .segment {
          flex: 1;
          min-width: 0;
          border-radius: 2px;
          background: var(--em-battery-empty-color, #292b2d);
          transition: background 0.4s ease;
        }
        .percent {
          font-size: 20px;
          min-width: 52px;
          text-align: right;
          color: #4bd45a;
          font-variant-numeric: tabular-nums;
        }
      </style>
      <ha-card>
        <div class="title"></div>
        <div class="display">
          <div class="segments"></div>
          <div class="percent">--%</div>
        </div>
      </ha-card>
    `;

    root.querySelector(".title").textContent = this.config.title;

    const bar = root.querySelector(".segments");
    bar.style.height = `${this.config.height}px`;

    const count = Math.max(1, Math.round(this.config.segments));
    this.segmentElements = [];

    for (let i = 0; i < count; i++) {
      const segment = document.createElement("div");
      segment.className = "segment";
      bar.appendChild(segment);
      this.segmentElements.push(segment);
    }

    if (this._hass) this.update();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.config) this.update();
  }

  update() {
    const state = this._hass.states[this.config.entity];
    const raw = state ? Number(state.state) : NaN;
    const valid = Number.isFinite(raw);
    const soc = valid ? Math.max(0, Math.min(100, raw)) : 0;

    const count = this.segmentElements.length;
    const active = Math.round((soc / 100) * count);

    const emptyColor = this._hass.themes?.darkMode
      ? "#292b2d"
      : "#e8e8e8";
    this.style.setProperty("--em-battery-empty-color", emptyColor);

    this.segmentElements.forEach((segment, i) => {
      const hue = (i / Math.max(1, count - 1)) * 120;
      segment.style.background = i < active
        ? `hsl(${hue}, 62%, 43%)`
        : emptyColor;
    });

    this.shadowRoot.querySelector(".percent").textContent =
      valid ? `${Math.round(soc)}%` : "--%";
  }

  getGridOptions() {
    return {
      columns: "full",
      rows: "auto"
    };
  }

  getCardSize() {
    return 2;
  }
}

if (!customElements.get("em-battery-bar-card")) {
  customElements.define("em-battery-bar-card", EMBatteryBarCard);
}
