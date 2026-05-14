(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const engine = window.ABGEngine;
  let latestReport = null;
  let selectedPhoto = null;
  let completionLabel = "";

  const coreFieldIds = ["pH", "paCO2", "paO2", "fio2", "hco3", "sbe", "sodium", "potassium", "chloride", "lactate", "sampleType"];

  const groups = [
    {
      title: "Core blood gas",
      tab: "core",
      fields: [
        { id: "pH", label: "pH", units: ["unitless"], required: true },
        { id: "paCO2", label: "PaCO2", units: ["mmHg", "kPa"], required: true },
        { id: "paO2", label: "PaO2", units: ["mmHg", "kPa"], required: true },
        { id: "fio2", label: "FiO2", units: ["percent", "fraction"], required: true },
        { id: "hco3", label: "HCO3", units: ["mmol/L", "mEq/L"], required: true },
        { id: "sbe", label: "SBE / BE", units: ["mmol/L"], required: true }
      ]
    },
    {
      title: "Core chemistry",
      tab: "core",
      fields: [
        { id: "sodium", label: "Sodium", units: ["mmol/L", "mEq/L"], required: true },
        { id: "potassium", label: "Potassium", units: ["mmol/L", "mEq/L"], required: true },
        { id: "chloride", label: "Chloride", units: ["mmol/L", "mEq/L"], required: true },
        { id: "lactate", label: "Lactate", units: ["mmol/L", "mg/dL", "mEq/L"], required: true },
        { id: "glucose", label: "Glucose", units: ["mg/dL", "mmol/L"] }
      ]
    },
    {
      title: "Extra labs",
      tab: "more",
      fields: [
        { id: "age", label: "Age", units: ["years"] },
        { id: "albumin", label: "Albumin", units: ["g/L", "g/dL"] },
        { id: "urea", label: "Urea / BUN", units: ["BUN_mg_dL", "urea_mmol_L", "urea_mg_dL"] },
        { id: "creatinine", label: "Creatinine", units: ["mg/dL", "micromol/L"] },
        { id: "measuredOsmolality", label: "Measured osmolality", units: ["mOsm/kg"] },
        { id: "betaHydroxybutyrate", label: "Beta-hydroxybutyrate", units: ["mmol/L", "mg/dL"] },
        { id: "phosphate", label: "Phosphate", units: ["mmol/L", "mg/dL"] },
        { id: "calcium", label: "Calcium", units: ["mmol/L", "mg/dL"] },
        { id: "magnesium", label: "Magnesium", units: ["mmol/L", "mg/dL"] }
      ]
    },
    {
      title: "Urine indices",
      tab: "more",
      fields: [
        { id: "urineSodium", label: "Urine sodium", units: ["mmol/L", "mEq/L"] },
        { id: "urinePotassium", label: "Urine potassium", units: ["mmol/L", "mEq/L"] },
        { id: "urineChloride", label: "Urine chloride", units: ["mmol/L", "mEq/L"] },
        { id: "urinePH", label: "Urine pH", units: ["unitless"] }
      ]
    }
  ];

  const sampleOptions = [
    ["arterial", "Arterial"],
    ["venous", "Venous"]
  ];

  const fieldHints = {
    pH: { min: "6.7", max: "7.8", title: "Usual arterial pH reference: 7.35-7.45" },
    paCO2: { min: "5", max: "150", title: "Usual PaCO2 reference: 35-45 mmHg" },
    paO2: { min: "20", max: "600", title: "Usual PaO2 reference depends on FiO2 and clinical context" },
    fio2: { min: "0.21", max: "100", title: "Enter 21-100 when unit is %, or 0.21-1.0 when unit is fraction" },
    hco3: { min: "2", max: "60", title: "Usual HCO3 reference: 22-26 mmol/L" },
    sbe: { min: "-40", max: "40", title: "Usual base excess reference: about -2 to +2 mmol/L" },
    sodium: { min: "100", max: "180", title: "Usual sodium reference: 135-145 mmol/L" },
    potassium: { min: "1", max: "10", title: "Usual potassium reference: 3.5-5.0 mmol/L" },
    chloride: { min: "60", max: "140", title: "Usual chloride reference: 95-110 mmol/L" },
    lactate: { min: "0", max: "30", title: "Lactate >=4 mmol/L is a danger flag" },
    glucose: { min: "0", max: "600", title: "Radiometer reports cGlu commonly in mg/dL" },
    age: { min: "0", max: "120", title: "Age helps screen the A-a gradient" }
  };

  const parsePatterns = [
    { id: "pH", label: "pH", units: "unitless", patterns: [/(?:^|[^A-Z0-9])PH[^0-9+\-.]{0,12}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "paCO2", label: "PaCO2", units: "mmHg", patterns: [/(?:^|[^A-Z0-9])(?:PA?CO2|PA?C02|PCO2|PC02|PACO2|PCO2)[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "paO2", label: "PaO2", units: "mmHg", patterns: [/(?:^|[^A-Z0-9])(?:PA?O2|PA?02|PO2|P02|PAO2|PO2)[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "hco3", label: "HCO3", units: "mmol/L", patterns: [/(?:^|[^A-Z0-9])CHCO3\s*-\s*\(\s*P\s*\)\s*C?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i, /(?:^|[^A-Z0-9])(?:HCO3|BICARB(?:ONATE)?|CHCO3)[^0-9+\-.]{0,24}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "sbe", label: "SBE / BE", units: "mmol/L", patterns: [/(?:^|[^A-Z0-9])C?BASE(?:\s*\([^)]*\))?C?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i, /(?:^|[^A-Z0-9])(?:SBE|ABE|BASE\s*EXCESS|BASE\s*EXC|B\.?E\.?|BE)[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "sodium", label: "Sodium", units: "mmol/L", patterns: [/(?:^|[^A-Z0-9])C?\s*NA\+?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i, /(?:^|[^A-Z0-9])SODIUM[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "potassium", label: "Potassium", units: "mmol/L", patterns: [/(?:^|[^A-Z0-9])C?\s*K\+?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i, /(?:^|[^A-Z0-9])POTASSIUM[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "chloride", label: "Chloride", units: "mmol/L", patterns: [/(?:^|[^A-Z0-9])C?\s*CL-?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i, /(?:^|[^A-Z0-9])CHLORIDE[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "lactate", label: "Lactate", units: "mmol/L", patterns: [/(?:^|[^A-Z0-9])C?\s*LAC(?:TATE|T)?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "albumin", label: "Albumin", units: "g/L", patterns: [/(?:^|[^A-Z0-9])(?:ALBUMIN|ALB)[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "fio2", label: "FiO2", units: "percent", patterns: [/(?:^|[^A-Z0-9])(?:FIO2|FI02|FO2\s*\(?I\)?|INSPIRED\s*O2)[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "glucose", label: "Glucose", units: "mg/dL", patterns: [/(?:^|[^A-Z0-9])C?\s*GLU(?:COSE)?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "measuredOsmolality", label: "Measured osmolality", units: "mOsm/kg", patterns: [/(?:^|[^A-Z0-9])M?OSM(?:C|OLALITY)?[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "calcium", label: "Calcium", units: "mmol/L", patterns: [/(?:^|[^A-Z0-9])C?\s*CA\+{0,2}[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "urea", label: "Urea / BUN", units: "BUN_mg_dL", patterns: [/(?:^|[^A-Z0-9])(?:BUN|UREA)[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "creatinine", label: "Creatinine", units: "mg/dL", patterns: [/(?:^|[^A-Z0-9])(?:CREATININE|CREAT|CR)[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] }
  ];

  const example = {
    pH: ["7.003", "unitless"],
    paCO2: ["49.3", "mmHg"],
    paO2: ["50", "mmHg"],
    fio2: ["100", "percent"],
    hco3: ["11.7", "mmol/L"],
    sbe: ["-17.4", "mmol/L"],
    sodium: ["126", "mmol/L"],
    potassium: ["3.6", "mmol/L"],
    chloride: ["142", "mmol/L"],
    lactate: ["12.1", "mmol/L"],
    glucose: ["49", "mg/dL"],
    measuredOsmolality: ["254.8", "mOsm/kg"],
    calcium: ["0.84", "mmol/L"]
  };

  function optionLabel(unit) {
    const labels = {
      auto: "auto",
      unitless: "unitless",
      fraction: "fraction",
      percent: "%",
      years: "years",
      urea_mmol_L: "urea mmol/L",
      BUN_mg_dL: "BUN mg/dL",
      urea_mg_dL: "urea mg/dL",
      "micromol/L": "umol/L"
    };
    return labels[unit] || unit;
  }

  function makeSection(group) {
    const section = document.createElement("section");
    section.className = "input-section";

    const head = document.createElement("div");
    head.className = "section-title";
    const title = document.createElement("h3");
    title.textContent = group.title;
    head.append(title);
    section.append(head);

    const grid = document.createElement("div");
    grid.className = "field-grid";
    group.fields.forEach((field) => {
      grid.append(makeField(field));
    });
    section.append(grid);
    return section;
  }

  function makeRequiredNote() {
    const note = document.createElement("p");
    note.className = "required-note";
    note.textContent = "Required values are marked *.";
    return note;
  }

  function makeField(field) {
    const template = $("#fieldTemplate").content.cloneNode(true);
    const label = template.querySelector(".field");
    const labelText = template.querySelector(".field-label");
    const input = template.querySelector("input");
    const select = template.querySelector("select");

    label.dataset.field = field.id;
    labelText.textContent = field.label;
    if (field.required) {
      const mark = document.createElement("span");
      mark.className = "required-mark";
      mark.textContent = "*";
      labelText.append(mark);
    }
    input.id = field.id;
    input.name = field.id;
    input.placeholder = "value";
    if (fieldHints[field.id]) {
      const hint = fieldHints[field.id];
      input.min = hint.min || "";
      input.max = hint.max || "";
      input.title = hint.title;
      labelText.title = hint.title;
    }
    select.id = `${field.id}Unit`;
    select.name = `${field.id}Unit`;
    field.units.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = optionLabel(unit);
      select.append(option);
    });
    if (field.units.length === 1) {
      select.disabled = true;
      label.classList.add("single-unit");
      const unitReadout = document.createElement("span");
      unitReadout.className = "unit-readout";
      unitReadout.textContent = optionLabel(field.units[0]);
      select.after(unitReadout);
    }
    return template;
  }

  function makeSampleType() {
    const wrapper = document.createElement("section");
    wrapper.className = "input-section";
    wrapper.innerHTML = `
      <div class="section-title"><h3>Sample</h3></div>
      <div class="field-grid">
        <label class="field wide-field single-control">
          <span>Sample type<span class="required-mark">*</span></span>
          <select id="sampleType"></select>
        </label>
      </div>
    `;
    const select = wrapper.querySelector("#sampleType");
    sampleOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    return wrapper;
  }

  function makeClinicalContext() {
    const wrapper = document.createElement("section");
    wrapper.className = "input-section";
    wrapper.innerHTML = `
      <fieldset class="flags-fieldset">
        <legend>Clinical context</legend>
        <div class="flags-grid" id="flagsGrid"></div>
      </fieldset>
    `;
    const flags = wrapper.querySelector("#flagsGrid");
    Object.entries(engine.FLAG_LABELS).forEach(([id, label]) => {
      const item = document.createElement("label");
      item.className = "flag-label";
      item.innerHTML = `<input type="checkbox" id="flag_${id}"><span>${label}</span>`;
      flags.append(item);
    });
    return wrapper;
  }

  function makeSettings() {
    const wrapper = document.createElement("section");
    wrapper.className = "input-section";
    wrapper.innerHTML = `
      <div class="section-title"><h3>Calculation settings</h3></div>
      <div class="settings-grid">
        <label class="field single-control">
          <span>Lab AG upper limit</span>
          <input id="agUpperLimit" inputmode="decimal" type="number" step="0.1" value="12">
        </label>
        <label class="field single-control">
          <span>Barometric pressure</span>
          <input id="barometricPressure" inputmode="decimal" type="number" step="1" value="760">
        </label>
        <label class="field single-control">
          <span>Respiratory quotient</span>
          <input id="respiratoryQuotient" inputmode="decimal" type="number" step="0.01" value="0.8">
        </label>
      </div>
    `;
    return wrapper;
  }

  function renderInputs() {
    const root = $("#inputSections");
    const panels = {
      core: document.createElement("div"),
      more: document.createElement("div"),
      context: document.createElement("div")
    };
    Object.entries(panels).forEach(([key, panel]) => {
      panel.className = "input-tab-panel";
      panel.dataset.inputPanel = key;
      if (key !== "core") panel.hidden = true;
    });
    panels.core.append(makeRequiredNote());
    groups.forEach((group) => panels[group.tab || "core"].append(makeSection(group)));
    panels.core.append(makeSampleType());
    panels.context.append(makeClinicalContext(), makeSettings());
    root.append(panels.core, panels.more, panels.context);
  }

  function readForm() {
    const raw = { flags: {} };
    groups.flatMap((group) => group.fields).forEach((field) => {
      const input = $(`#${field.id}`);
      const unit = $(`#${field.id}Unit`);
      raw[field.id] = {
        value: input ? input.value : "",
        unit: unit ? unit.value : ""
      };
    });
    raw.sampleType = $("#sampleType").value;
    Object.keys(engine.FLAG_LABELS).forEach((key) => {
      raw.flags[key] = $(`#flag_${key}`).checked;
    });
    return raw;
  }

  function settings() {
    return {
      agUpperLimit: $("#agUpperLimit").value,
      barometricPressure: $("#barometricPressure").value,
      respiratoryQuotient: $("#respiratoryQuotient").value
    };
  }

  function countEntered(fieldIds) {
    const raw = readForm();
    return fieldIds.filter((field) => {
      if (field === "sampleType") return Boolean(raw.sampleType);
      return raw[field] && raw[field].value !== "";
    }).length;
  }

  function updateCompletion() {
    const coreDone = countEntered(coreFieldIds);
    const fullDone = countEntered(engine.REQUIRED_FIELDS);
    const status = $("#completionStatus");
    const nextLabel = `${coreDone}/${coreFieldIds.length} core`;
    status.textContent = nextLabel;
    status.title = `${fullDone}/${engine.REQUIRED_FIELDS.length} full fields available`;
    status.classList.toggle("complete", coreDone === coreFieldIds.length);
    if (completionLabel && completionLabel !== nextLabel) {
      status.classList.remove("pulse");
      const animate = window.requestAnimationFrame || ((callback) => callback());
      animate(() => status.classList.add("pulse"));
    }
    completionLabel = nextLabel;
    updateTabBadges();
  }

  function updateTabBadges() {
    const raw = readForm();
    const moreFields = groups
      .filter((group) => group.tab === "more")
      .flatMap((group) => group.fields)
      .filter((field) => raw[field.id] && raw[field.id].value !== "").length;
    const contextFlags = Object.keys(engine.FLAG_LABELS).filter((key) => raw.flags[key]).length;
    setTabBadge("more", moreFields);
    setTabBadge("context", contextFlags);
  }

  function setTabBadge(tab, count) {
    const button = document.querySelector(`[data-input-tab="${tab}"]`);
    if (!button) return;
    button.dataset.badge = count ? String(count) : "";
    button.classList.toggle("has-data", count > 0);
  }

  function setExample() {
    resetForm();
    Object.entries(example).forEach(([id, [value, unit]]) => {
      const input = $(`#${id}`);
      const select = $(`#${id}Unit`);
      if (input) input.value = value;
      if (select) select.value = unit;
    });
    $("#sampleType").value = "arterial";
    $("#flag_sepsis").checked = true;
    $("#flag_shock").checked = true;
    $("#flag_renalFailure").checked = true;
    analyze();
  }

  function resetForm(options = {}) {
    if (options.confirm && !window.confirm("Clear all entered values and the current interpretation?")) return;
    $("#abgForm").reset();
    selectedPhoto = null;
    if ($("#uploadImageInput")) $("#uploadImageInput").value = "";
    if ($("#cameraImageInput")) $("#cameraImageInput").value = "";
    $("#photoPreview").innerHTML = "<span>No image selected</span>";
    $("#ocrText").value = "";
    $("#ocrStatus").textContent = "No photo";
    $("#parsedSummary").innerHTML = "";
    $("#agUpperLimit").value = "12";
    $("#barometricPressure").value = "760";
    $("#respiratoryQuotient").value = "0.8";
    activateInputTab("core");
    latestReport = null;
    $("#reportTimestamp").textContent = "Waiting for input";
    $("#report").className = "report-empty";
    $("#report").innerHTML = "<h3>Ready for analysis</h3><p>Enter pH, PaCO2, HCO3, and electrolytes to see the interpretation.</p>";
    updateCompletion();
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function detectUnit(line, field, fallback) {
    const text = line.toUpperCase();
    if (field === "paCO2" || field === "paO2") {
      if (text.includes("KPA")) return "kPa";
      if (text.includes("MMHG") || text.includes("MM HG")) return "mmHg";
      return fallback;
    }
    if (field === "fio2") {
      if (text.includes("%")) return "percent";
      return fallback;
    }
    if (field === "albumin") {
      if (text.includes("G/DL") || text.includes("G / DL")) return "g/dL";
      if (text.includes("G/L") || text.includes("G / L")) return "g/L";
      return fallback;
    }
    if (field === "lactate" || field === "glucose" || field === "betaHydroxybutyrate") {
      if (text.includes("MG/DL") || text.includes("MG / DL")) return "mg/dL";
      if (text.includes("MMOL")) return "mmol/L";
      return fallback;
    }
    if (field === "urea") {
      if (text.includes("BUN") && text.includes("MG")) return "BUN_mg_dL";
      if (text.includes("UREA") && text.includes("MG")) return "urea_mg_dL";
      if (text.includes("MMOL")) return "urea_mmol_L";
      return fallback;
    }
    if (field === "creatinine") {
      if (text.includes("UMOL") || text.includes("µMOL") || text.includes("MICROMOL")) return "micromol/L";
      if (text.includes("MG/DL") || text.includes("MG / DL")) return "mg/dL";
      return fallback;
    }
    return fallback;
  }

  function parseOcrText(text) {
    const normalized = text
      .replace(/[−–—]/g, "-")
      .replace(/[₂]/g, "2")
      .replace(/[₃]/g, "3")
      .replace(/[|]/g, " ")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const searchText = normalized.join("\n");
    const found = [];
    parsePatterns.forEach((field) => {
      let match = null;
      let matchedLine = "";
      for (const pattern of field.patterns) {
        for (const line of normalized) {
          match = line.match(pattern);
          if (match) {
            matchedLine = line;
            break;
          }
        }
        if (match) break;
      }
      if (!match) {
        for (const pattern of field.patterns) {
          match = searchText.match(pattern);
          if (match) {
            matchedLine = match[0];
            break;
          }
        }
      }
      if (!match) return;
      const value = match[1].replace(",", ".");
      if (!Number.isFinite(Number(value))) return;
      found.push({
        id: field.id,
        label: field.label,
        value,
        unit: detectUnit(matchedLine, field.id, field.units),
        source: matchedLine
      });
    });
    return found;
  }

  function applyParsedValues(values) {
    values.forEach((item) => {
      const input = $(`#${item.id}`);
      const unit = $(`#${item.id}Unit`);
      if (input) input.value = item.value;
      if (unit && [...unit.options].some((option) => option.value === item.unit)) {
        unit.value = item.unit;
      }
    });
    updateCompletion();
  }

  function renderParsedSummary(values) {
    const root = $("#parsedSummary");
    if (!values.length) {
      root.innerHTML = "<div class=\"clinical-warning\">No ABG values were confidently extracted. Try cropping the image around the result table or paste OCR text manually.</div>";
      return;
    }
    root.innerHTML = `
      <div class="parsed-chip-row">
        ${values.map((item) => `
          <div class="parsed-row">
            <span>${escapeHTML(item.label)}</span>
            <strong>${escapeHTML(item.value)} ${escapeHTML(optionLabel(item.unit))}</strong>
          </div>
        `).join("")}
      </div>
      <button class="dismiss-button" id="dismissParsedSummary" type="button" aria-label="Clear extracted value summary">Clear extracted summary</button>
      <div class="clinical-warning">Review every extracted value and unit before using the interpretation. Photo OCR can misread decimals, minus signs, and units.</div>
    `;
    $("#dismissParsedSummary").addEventListener("click", () => {
      root.innerHTML = "";
    });
  }

  function useOcrText() {
    const values = parseOcrText($("#ocrText").value);
    applyParsedValues(values);
    renderParsedSummary(values);
    $("#ocrStatus").textContent = values.length ? `${values.length} values found` : "Review needed";
  }

  async function readPhoto() {
    if (!selectedPhoto) {
      $("#ocrStatus").textContent = "Choose photo";
      return;
    }
    if (!window.Tesseract) {
      $("#ocrStatus").textContent = "OCR unavailable";
      $("#parsedSummary").innerHTML = "<div class=\"clinical-warning\">OCR library could not load. If this is opened offline, deploy or connect to the internet, or paste text manually.</div>";
      return;
    }
    $("#ocrStatus").textContent = "Reading...";
    $("#readPhoto").disabled = true;
    try {
      const result = await window.Tesseract.recognize(selectedPhoto, "eng", {
        logger(message) {
          if (message.status === "recognizing text" && Number.isFinite(message.progress)) {
            $("#ocrStatus").textContent = `${Math.round(message.progress * 100)}%`;
          }
        }
      });
      $("#ocrText").value = result.data.text.trim();
      useOcrText();
    } catch (error) {
      $("#ocrStatus").textContent = "OCR failed";
      $("#parsedSummary").innerHTML = `<div class="clinical-warning">Could not read this photo: ${escapeHTML(error.message || error)}</div>`;
    } finally {
      $("#readPhoto").disabled = false;
    }
  }

  function onPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    selectedPhoto = file || null;
    if (event.target.id === "uploadImageInput") $("#cameraImageInput").value = "";
    if (event.target.id === "cameraImageInput") $("#uploadImageInput").value = "";
    $("#ocrText").value = "";
    $("#parsedSummary").innerHTML = "";
    if (!file) {
      $("#photoPreview").innerHTML = "<span>No image selected</span>";
      $("#ocrStatus").textContent = "No photo";
      return;
    }
    const url = URL.createObjectURL(file);
    $("#photoPreview").innerHTML = `<img alt="Selected ABG photo" src="${url}">`;
    $("#ocrStatus").textContent = "Photo ready";
  }

  function clearPhotoOnly() {
    selectedPhoto = null;
    $("#uploadImageInput").value = "";
    $("#cameraImageInput").value = "";
    $("#photoPreview").innerHTML = "<span>No image selected</span>";
    $("#ocrText").value = "";
    $("#ocrStatus").textContent = "No photo";
    $("#parsedSummary").innerHTML = "";
  }

  function activateInputTab(tab) {
    document.querySelectorAll("[data-input-tab]").forEach((button) => {
      const active = button.dataset.inputTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-input-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.inputPanel !== tab;
    });
  }

  function bindInputTabs() {
    document.querySelectorAll("[data-input-tab]").forEach((button) => {
      button.addEventListener("click", () => activateInputTab(button.dataset.inputTab));
    });
  }

  function activateReportTab(tab) {
    document.querySelectorAll("[data-report-tab]").forEach((button) => {
      const active = button.dataset.reportTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-report-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.reportPanel !== tab;
    });
  }

  function bindReportTabs() {
    document.querySelectorAll("[data-report-tab]").forEach((button) => {
      button.addEventListener("click", () => activateReportTab(button.dataset.reportTab));
    });
  }

  function list(items, className) {
    if (!items || !items.length) return "<p class=\"muted-line\">None detected from available data.</p>";
    return `<ul class="line-list">${items.map((item) => `<li class="${className || ""}">${escapeHTML(item)}</li>`).join("")}</ul>`;
  }

  function orderedList(items, className) {
    if (!items || !items.length) return "<p class=\"muted-line\">Not available from the entered values.</p>";
    return `<ol class="step-list">${items.map((item) => `<li class="${className || ""}">${escapeHTML(item)}</li>`).join("")}</ol>`;
  }

  function chips(report) {
    const tags = [];
    const status = report.severity.pH_status;
    if (status === "Acidemia") tags.push(["acid", "Acidemia"]);
    else if (status === "Alkalemia") tags.push(["alkali", "Alkalemia"]);
    else if (status === "Near-normal pH") tags.push(["warn", "Near-normal pH"]);
    if (report.metabolic_analysis.anion_gap_category) tags.push(["", report.metabolic_analysis.anion_gap_category]);
    if (report.alactic_base_excess.interpretation) tags.push(["", report.alactic_base_excess.interpretation]);
    if (report.severity.danger_flags.length) tags.push(["acid", "Danger flags"]);
    return `<div class="chip-row">${tags.map(([type, text]) => `<span class="tag ${type}">${escapeHTML(text)}</span>`).join("")}</div>`;
  }

  function metric(label, value, note, tone) {
    const toneClass = ["acid", "alkali", "warn", "good"].includes(tone) ? ` ${tone}` : "";
    return `
      <div class="metric${toneClass}">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value || "-")}</strong>
        <small>${escapeHTML(note || "")}</small>
      </div>
    `;
  }

  function metricGrid(report) {
    const m = report.metabolic_analysis;
    const a = report.alactic_base_excess;
    const o = report.oxygenation;
    const pH = report.unit_normalization.converted_inputs.pH?.value || "";
    const agLabel = report.unit_normalization.converted_inputs.albumin?.value !== "" ? "Corrected AG" : "Anion gap";
    const phTone = report.severity.pH_status === "Acidemia" ? "acid" : report.severity.pH_status === "Alkalemia" ? "alkali" : "good";
    const agTone = m.anion_gap_category === "high anion gap" ? "acid" : m.anion_gap_category === "low anion gap" ? "warn" : "good";
    const abeTone = Number(a.ABE) < -2 ? "acid" : Number(a.ABE) > 2 ? "alkali" : "good";
    const oxyTone = String(o.oxygenation_interpretation || "").toLowerCase().includes("elevated") ? "warn" : "good";
    return `
      <div class="metric-grid priority-metrics">
        ${metric("pH", pH, report.severity.pH_status, phTone)}
        ${metric(agLabel, m.corrected_anion_gap, m.anion_gap_category, agTone)}
        ${metric("ABE", a.ABE, a.interpretation, abeTone)}
        ${metric("A-a gradient", o.A_a_gradient, o.oxygenation_interpretation, oxyTone)}
      </div>
    `;
  }

  function stewartMetricGrid(report) {
    const s = report.stewart_light;
    const m = report.metabolic_analysis;
    return `
      <div class="metric-grid stewart-metrics">
        ${metric("Delta gap", m.delta_AG !== "" ? m.delta_AG - m.delta_HCO3 : "", m.delta_interpretation)}
        ${metric("SBE SID", s.SBE_SID, "Strong ion effect")}
        ${metric("SBE albumin", s.SBE_albumin, "Weak acid effect")}
        ${metric("SBE UI", s.SBE_unmeasured_ions, "Unmeasured ions")}
        ${metric("UI after lactate", s.SBE_unmeasured_ions_after_lactate, "Non-lactate residual")}
      </div>
    `;
  }

  function convertedRows(report) {
    const input = report.unit_normalization.converted_inputs;
    const wanted = ["pH", "paCO2", "paO2", "fio2", "hco3", "sbe", "sodium", "potassium", "chloride", "lactate", "albumin", "glucose", "urea", "creatinine"];
    const rows = wanted
      .filter((key) => input[key] && input[key].value !== "")
      .map((key) => `
        <tr>
          <td>${escapeHTML(key)}</td>
          <td>${escapeHTML(input[key].raw_value)} ${escapeHTML(input[key].raw_unit)}</td>
          <td>${escapeHTML(input[key].value)} ${escapeHTML(input[key].unit)}</td>
        </tr>
      `)
      .join("");
    if (!rows) return "";
    return `
      <table class="data-table">
        <thead><tr><th>Field</th><th>Raw</th><th>Internal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderReport(report) {
    const headline = report.primary_interpretation.primary_disorders[0] || report.severity.pH_status;
    const danger = report.severity.danger_flags.concat(report.validation_warnings || []);
    const unitNotes = report.unit_normalization.unit_warnings.concat(report.unit_normalization.blocked_calculations);
    const steps = report.stepwise_interpretation || {
      interpretation_steps: report.final_diagnosis,
      calculations: [],
      possible_reasons: report.likely_causes
    };
    $("#report").className = "";
    $("#report").innerHTML = `
      <section class="diagnosis-card">
        <div class="diagnosis-title">Primary read</div>
        <div class="lead-diagnosis">${escapeHTML(headline)}</div>
        ${chips(report)}
      </section>

      <section class="report-block">
        ${metricGrid(report)}
      </section>

      <div class="tab-strip report-tabs" role="tablist" aria-label="Report sections">
        <button class="tab-button active" type="button" role="tab" aria-selected="true" data-report-tab="summary">Step read</button>
        <button class="tab-button" type="button" role="tab" aria-selected="false" data-report-tab="stewart">Stewart</button>
        <button class="tab-button" type="button" role="tab" aria-selected="false" data-report-tab="values">Values</button>
        <button class="tab-button" type="button" role="tab" aria-selected="false" data-report-tab="json">JSON</button>
      </div>

      <div class="report-tab-panels">
        <section class="report-tab-panel" data-report-panel="summary">
          <section class="report-block">
            <h3>Step-by-step read</h3>
            ${orderedList(steps.interpretation_steps)}
          </section>
          <section class="report-block">
            <h3>Calculations used</h3>
            ${orderedList(steps.calculations, "calc-line")}
          </section>
          <section class="report-block">
            <h3>Checks and missing tests</h3>
            <div class="two-col">
              <div>
                ${list(danger, "danger-line")}
                ${unitNotes.length ? `<div class="clinical-warning">${escapeHTML(unitNotes.join(" "))}</div>` : ""}
              </div>
              <div>
                ${list(report.recommended_missing_tests)}
              </div>
            </div>
          </section>
          <section class="report-block">
            <h3>Possible reasons</h3>
            ${list(steps.possible_reasons)}
          </section>
        </section>

        <section class="report-tab-panel" data-report-panel="stewart" hidden>
          <section class="report-block">
            ${stewartMetricGrid(report)}
          </section>
          <section class="report-block">
            <h3>Stewart light</h3>
            ${list(report.stewart_light.interpretation)}
          </section>
        </section>

        <section class="report-tab-panel" data-report-panel="values" hidden>
          <section class="report-block">
            <h3>Converted values</h3>
            ${convertedRows(report)}
          </section>
        </section>

        <section class="report-tab-panel" data-report-panel="json" hidden>
          <section class="report-block">
            <h3>Structured output</h3>
            <pre class="json-box">${escapeHTML(JSON.stringify(report, null, 2))}</pre>
          </section>
        </section>
      </div>

      <div class="clinical-warning">${escapeHTML(report.clinical_warning)}</div>
    `;
    $("#reportTimestamp").textContent = `Calculated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    bindReportTabs();
  }

  function analyze() {
    setAnalyzing(true);
    try {
      latestReport = engine.analyze(readForm(), settings());
      renderReport(latestReport);
      updateCompletion();
    } finally {
      setAnalyzing(false);
    }
  }

  function setAnalyzing(active) {
    ["#runAnalysis", "#runAnalysisInline"].forEach((selector) => {
      const button = $(selector);
      if (!button) return;
      button.disabled = active;
      button.textContent = active ? "Analyzing..." : "Analyze";
    });
    $("#report").setAttribute("aria-busy", String(active));
  }

  function copyJson() {
    if (!latestReport) analyze();
    const payload = JSON.stringify(latestReport, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(payload);
      $("#copyJson").textContent = "Copied";
      setTimeout(() => { $("#copyJson").textContent = "JSON"; }, 1000);
    }
  }

  function bindEvents() {
    $("#runAnalysis").addEventListener("click", analyze);
    $("#runAnalysisInline").addEventListener("click", analyze);
    $("#loadExample").addEventListener("click", setExample);
    $("#resetForm").addEventListener("click", () => resetForm({ confirm: true }));
    $("#copyJson").addEventListener("click", copyJson);
    $("#uploadImageInput").addEventListener("change", onPhotoSelected);
    $("#cameraImageInput").addEventListener("change", onPhotoSelected);
    $("#readPhoto").addEventListener("click", readPhoto);
    $("#parseText").addEventListener("click", useOcrText);
    $("#clearPhoto").addEventListener("click", clearPhotoOnly);
    $("#abgForm").addEventListener("input", updateCompletion);
    $("#abgForm").addEventListener("change", updateCompletion);
    $("#abgForm").addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        analyze();
      }
    });
  }

  renderInputs();
  bindEvents();
  bindInputTabs();
  updateCompletion();
})();
