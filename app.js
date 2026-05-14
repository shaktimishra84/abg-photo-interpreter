(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const engine = window.ABGEngine;
  let latestReport = null;
  let selectedPhoto = null;

  const groups = [
    {
      title: "Required blood gas",
      fields: [
        { id: "pH", label: "pH", units: ["unitless"], required: true },
        { id: "paCO2", label: "PaCO2", units: ["auto", "mmHg", "kPa"], required: true },
        { id: "paO2", label: "PaO2", units: ["auto", "mmHg", "kPa"], required: true },
        { id: "fio2", label: "FiO2", units: ["auto", "fraction", "percent"], required: true },
        { id: "hco3", label: "HCO3", units: ["mmol/L", "mEq/L"], required: true },
        { id: "sbe", label: "SBE / BE", units: ["mmol/L"], required: true }
      ]
    },
    {
      title: "Required chemistry",
      fields: [
        { id: "sodium", label: "Sodium", units: ["mmol/L", "mEq/L"], required: true },
        { id: "potassium", label: "Potassium", units: ["mmol/L", "mEq/L"], required: true },
        { id: "chloride", label: "Chloride", units: ["mmol/L", "mEq/L"], required: true },
        { id: "lactate", label: "Lactate", units: ["auto", "mmol/L", "mg/dL", "mEq/L"], required: true },
        { id: "albumin", label: "Albumin", units: ["auto", "g/L", "g/dL"], required: true },
        { id: "age", label: "Age", units: ["years"], required: true }
      ]
    },
    {
      title: "Recommended labs",
      fields: [
        { id: "glucose", label: "Glucose", units: ["auto", "mmol/L", "mg/dL"] },
        { id: "urea", label: "Urea / BUN", units: ["auto", "urea_mmol_L", "BUN_mg_dL", "urea_mg_dL"] },
        { id: "creatinine", label: "Creatinine", units: ["auto", "mg/dL", "micromol/L"] },
        { id: "measuredOsmolality", label: "Measured osmolality", units: ["mOsm/kg"] },
        { id: "betaHydroxybutyrate", label: "Beta-hydroxybutyrate", units: ["mmol/L", "mg/dL"] },
        { id: "phosphate", label: "Phosphate", units: ["mmol/L", "mg/dL"] },
        { id: "calcium", label: "Calcium", units: ["mmol/L", "mg/dL"] },
        { id: "magnesium", label: "Magnesium", units: ["mmol/L", "mg/dL"] }
      ]
    },
    {
      title: "Urine indices",
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

  const parsePatterns = [
    { id: "pH", label: "pH", units: "unitless", patterns: [/(?:^|[^A-Z0-9])PH[^0-9+\-.]{0,12}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "paCO2", label: "PaCO2", units: "auto", patterns: [/\b(?:PA?CO2|PA?C02|PCO2|PC02|PACO₂|PCO₂)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "paO2", label: "PaO2", units: "auto", patterns: [/\b(?:PA?O2|PA?02|PO2|P02|PAO₂|PO₂)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "hco3", label: "HCO3", units: "mmol/L", patterns: [/\b(?:HCO3|HCO₃|BICARB(?:ONATE)?|CHCO3)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "sbe", label: "SBE / BE", units: "mmol/L", patterns: [/\b(?:SBE|ABE|BASE\s*EXCESS|BASE\s*EXC|B\.?E\.?|BE)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "sodium", label: "Sodium", units: "mmol/L", patterns: [/\b(?:NA\+?|SODIUM)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "potassium", label: "Potassium", units: "mmol/L", patterns: [/\b(?:K\+?|POTASSIUM)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "chloride", label: "Chloride", units: "mmol/L", patterns: [/\b(?:CL-?|CHLORIDE)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "lactate", label: "Lactate", units: "auto", patterns: [/\b(?:LACTATE|LACT|LAC)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "albumin", label: "Albumin", units: "auto", patterns: [/\b(?:ALBUMIN|ALB)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "fio2", label: "FiO2", units: "auto", patterns: [/\b(?:FIO2|FI02|INSPIRED\s*O2)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "glucose", label: "Glucose", units: "auto", patterns: [/\b(?:GLUCOSE|GLU)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "urea", label: "Urea / BUN", units: "auto", patterns: [/\b(?:BUN|UREA)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] },
    { id: "creatinine", label: "Creatinine", units: "auto", patterns: [/\b(?:CREATININE|CREAT|CR)\b[^0-9+\-.]{0,18}([+\-]?\d+(?:[.,]\d+)?)/i] }
  ];

  const example = {
    pH: ["7.12", "unitless"],
    paCO2: ["38", "mmHg"],
    paO2: ["78", "mmHg"],
    fio2: ["0.21", "fraction"],
    hco3: ["12", "mmol/L"],
    sbe: ["-15", "mmol/L"],
    sodium: ["140", "mmol/L"],
    potassium: ["4.8", "mmol/L"],
    chloride: ["112", "mmol/L"],
    lactate: ["6", "mmol/L"],
    albumin: ["2.4", "g/dL"],
    age: ["62", "years"],
    glucose: ["165", "mg/dL"],
    urea: ["42", "BUN_mg_dL"],
    creatinine: ["2.2", "mg/dL"],
    measuredOsmolality: ["318", "mOsm/kg"],
    urineSodium: ["28", "mmol/L"],
    urinePotassium: ["18", "mmol/L"],
    urineChloride: ["30", "mmol/L"]
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
    }
    return template;
  }

  function makeSampleType() {
    const wrapper = document.createElement("section");
    wrapper.className = "input-section";
    wrapper.innerHTML = `
      <div class="section-title"><h3>Sample and clinical flags</h3></div>
      <div class="field-grid">
        <label class="field wide-field single-control">
          <span>Sample type<span class="required-mark">*</span></span>
          <select id="sampleType"></select>
        </label>
      </div>
      <div class="flags-grid" id="flagsGrid"></div>
    `;
    const select = wrapper.querySelector("#sampleType");
    sampleOptions.forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });
    const flags = wrapper.querySelector("#flagsGrid");
    Object.entries(engine.FLAG_LABELS).forEach(([id, label]) => {
      const item = document.createElement("label");
      item.className = "flag-label";
      item.innerHTML = `<input type="checkbox" id="flag_${id}"><span>${label}</span>`;
      flags.append(item);
    });
    return wrapper;
  }

  function renderInputs() {
    const root = $("#inputSections");
    groups.forEach((group) => root.append(makeSection(group)));
    root.append(makeSampleType());
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

  function requiredCount() {
    const raw = readForm();
    return engine.REQUIRED_FIELDS.filter((field) => {
      if (field === "sampleType") return Boolean(raw.sampleType);
      return raw[field] && raw[field].value !== "";
    }).length;
  }

  function updateCompletion() {
    const done = requiredCount();
    $("#completionStatus").textContent = `${done}/${engine.REQUIRED_FIELDS.length} required`;
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

  function resetForm() {
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
    latestReport = null;
    $("#reportTimestamp").textContent = "Waiting for input";
    $("#report").className = "report-empty";
    $("#report").innerHTML = "<h3>Ready for analysis</h3><p>Complete the required fields and run the rule engine.</p>";
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
      for (const line of normalized) {
        for (const pattern of field.patterns) {
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
    if (!$("#age").value) $("#age").value = "";
    if (!$("#fio2").value) $("#fio2").value = "0.21";
    updateCompletion();
  }

  function renderParsedSummary(values) {
    const root = $("#parsedSummary");
    if (!values.length) {
      root.innerHTML = "<div class=\"clinical-warning\">No ABG values were confidently extracted. Try cropping the image around the result table or paste OCR text manually.</div>";
      return;
    }
    root.innerHTML = values.map((item) => `
      <div class="parsed-row">
        <span>${escapeHTML(item.label)}</span>
        <strong>${escapeHTML(item.value)} ${escapeHTML(optionLabel(item.unit))}</strong>
      </div>
    `).join("") + "<div class=\"clinical-warning\">Review every extracted value and unit before using the interpretation. Photo OCR can misread decimals, minus signs, and units.</div>";
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

  function list(items, className) {
    if (!items || !items.length) return "<p class=\"muted-line\">None detected from available data.</p>";
    return `<ul class="line-list">${items.map((item) => `<li class="${className || ""}">${escapeHTML(item)}</li>`).join("")}</ul>`;
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

  function metric(label, value, note) {
    return `
      <div class="metric">
        <span>${escapeHTML(label)}</span>
        <strong>${escapeHTML(value || "-")}</strong>
        <small>${escapeHTML(note || "")}</small>
      </div>
    `;
  }

  function metricGrid(report) {
    const m = report.metabolic_analysis;
    const s = report.stewart_light;
    const a = report.alactic_base_excess;
    const o = report.oxygenation;
    return `
      <div class="metric-grid">
        ${metric("Corrected AG", m.corrected_anion_gap, m.anion_gap_category)}
        ${metric("Delta gap", m.delta_AG !== "" ? m.delta_AG - m.delta_HCO3 : "", m.delta_interpretation)}
        ${metric("ABE", a.ABE, a.interpretation)}
        ${metric("A-a gradient", o.A_a_gradient, o.oxygenation_interpretation)}
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

      <div class="two-col">
        <section class="report-block">
          <h3>Layered diagnosis</h3>
          ${list(report.final_diagnosis)}
        </section>
        <section class="report-block">
          <h3>Danger and unit checks</h3>
          ${list(danger, "danger-line")}
          ${unitNotes.length ? `<div class="clinical-warning">${escapeHTML(unitNotes.join(" "))}</div>` : ""}
        </section>
      </div>

      <div class="two-col">
        <section class="report-block">
          <h3>Likely causes</h3>
          ${list(report.likely_causes)}
        </section>
        <section class="report-block">
          <h3>Missing tests</h3>
          ${list(report.recommended_missing_tests)}
        </section>
      </div>

      <section class="report-block">
        <h3>Stewart light</h3>
        ${list(report.stewart_light.interpretation)}
      </section>

      <section class="report-block">
        <h3>Converted values</h3>
        ${convertedRows(report)}
      </section>

      <section class="report-block">
        <h3>Structured output</h3>
        <pre class="json-box">${escapeHTML(JSON.stringify(report, null, 2))}</pre>
      </section>

      <div class="clinical-warning">${escapeHTML(report.clinical_warning)}</div>
    `;
    $("#reportTimestamp").textContent = `Calculated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function analyze() {
    latestReport = engine.analyze(readForm(), settings());
    renderReport(latestReport);
    updateCompletion();
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
    $("#loadExample").addEventListener("click", setExample);
    $("#resetForm").addEventListener("click", resetForm);
    $("#copyJson").addEventListener("click", copyJson);
    $("#uploadImageInput").addEventListener("change", onPhotoSelected);
    $("#cameraImageInput").addEventListener("change", onPhotoSelected);
    $("#readPhoto").addEventListener("click", readPhoto);
    $("#parseText").addEventListener("click", useOcrText);
    $("#clearPhoto").addEventListener("click", clearPhotoOnly);
    $("#abgForm").addEventListener("input", updateCompletion);
    $("#abgForm").addEventListener("change", updateCompletion);
  }

  renderInputs();
  bindEvents();
  updateCompletion();
})();
