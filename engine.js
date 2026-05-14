(function () {
  "use strict";

  const INTERNAL_UNITS = {
    pH: "unitless",
    paCO2: "mmHg",
    paO2: "mmHg",
    hco3: "mmol/L",
    sbe: "mmol/L",
    sodium: "mmol/L",
    potassium: "mmol/L",
    chloride: "mmol/L",
    lactate: "mmol/L",
    albumin: "g/L",
    fio2: "fraction",
    glucose: "mmol/L",
    urea: "mmol/L",
    creatinine: "mg/dL",
    measuredOsmolality: "mOsm/kg",
    betaHydroxybutyrate: "mmol/L",
    urineSodium: "mmol/L",
    urinePotassium: "mmol/L",
    urineChloride: "mmol/L",
    urinePH: "unitless",
    phosphate: "mmol/L",
    calcium: "mmol/L",
    magnesium: "mmol/L"
  };

  const REQUIRED_FIELDS = [
    "pH",
    "paCO2",
    "paO2",
    "fio2",
    "hco3",
    "sbe",
    "sodium",
    "potassium",
    "chloride",
    "lactate",
    "sampleType"
  ];

  const FLAG_LABELS = {
    vomiting: "Vomiting",
    diarrhea: "Diarrhea",
    renalFailure: "Renal failure",
    sepsis: "Sepsis",
    shock: "Shock",
    pregnancy: "Pregnancy",
    liverDisease: "Liver disease",
    salicylate: "Salicylate use",
    toxicAlcohol: "Toxic alcohol suspicion",
    diuretics: "Diuretics",
    acetazolamide: "Acetazolamide/topiramate",
    ventilated: "Ventilation support",
    hypertension: "Hypertension"
  };

  const round = (value, digits = 1) => {
    if (!Number.isFinite(value)) return "";
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };

  const has = (value) => Number.isFinite(value);
  const inRange = (value, min, max) => value >= min && value <= max;

  function makeResult(field, rawValue, rawUnit, convertedValue, internalUnit, warning, confirmed) {
    return {
      field,
      rawValue,
      rawUnit,
      value: convertedValue,
      internalUnit,
      warning: warning || "",
      confirmed: Boolean(confirmed)
    };
  }

  function blocked(field, rawValue, rawUnit, warning) {
    return makeResult(field, rawValue, rawUnit, NaN, INTERNAL_UNITS[field] || "", warning, false);
  }

  function convertAutoGas(field, value, unit, isOxygen) {
    const label = field === "paCO2" ? "PaCO2" : "PaO2";
    if (unit === "mmHg") return makeResult(field, value, unit, value, "mmHg", "", true);
    if (unit === "kPa") return makeResult(field, value, unit, value * 7.5006, "mmHg", "", true);
    if (field === "paCO2") {
      if (inRange(value, 3, 15)) {
        return makeResult(field, value, "auto", value * 7.5006, "mmHg", `${label} ${value} likely kPa; converted to ${round(value * 7.5006)} mmHg.`, false);
      }
      if (inRange(value, 20, 100)) {
        return makeResult(field, value, "auto", value, "mmHg", `${label} ${value} likely mmHg.`, false);
      }
    }
    if (isOxygen) {
      if (value >= 5 && value < 40) {
        return makeResult(field, value, "auto", value * 7.5006, "mmHg", `${label} ${value} likely kPa; converted to ${round(value * 7.5006)} mmHg.`, false);
      }
      if (inRange(value, 40, 600)) {
        return makeResult(field, value, "auto", value, "mmHg", `${label} ${value} likely mmHg.`, false);
      }
    }
    return blocked(field, value, "auto", `${label} unit is ambiguous. Confirm mmHg or kPa before using dependent calculations.`);
  }

  function convertField(field, rawValue, rawUnit) {
    const value = Number(rawValue);
    const unit = rawUnit || "auto";
    if (!Number.isFinite(value)) return makeResult(field, NaN, unit, NaN, INTERNAL_UNITS[field] || "", "", unit !== "auto");

    switch (field) {
      case "pH":
      case "age":
      case "urinePH":
      case "measuredOsmolality":
        return makeResult(field, value, unit, value, INTERNAL_UNITS[field] || "", "", true);
      case "paCO2":
        return convertAutoGas(field, value, unit, false);
      case "paO2":
        return convertAutoGas(field, value, unit, true);
      case "fio2":
        if (unit === "fraction") return makeResult(field, value, unit, value, "fraction", "", true);
        if (unit === "percent") return makeResult(field, value, unit, value / 100, "fraction", "", true);
        if (value > 1 && value <= 100) {
          return makeResult(field, value, "auto", value / 100, "fraction", `FiO2 ${value} interpreted as ${value}%.`, false);
        }
        if (value >= 0.21 && value <= 1) {
          return makeResult(field, value, "auto", value, "fraction", `FiO2 ${value} interpreted as a fraction.`, false);
        }
        return blocked(field, value, "auto", "FiO2 unit is ambiguous or outside expected range.");
      case "hco3":
      case "sbe":
      case "sodium":
      case "potassium":
      case "chloride":
      case "urineSodium":
      case "urinePotassium":
      case "urineChloride":
        return makeResult(field, value, unit, value, INTERNAL_UNITS[field], unit === "mEq/L" ? `${field} entered as mEq/L; treated as mmol/L for monovalent ions.` : "", unit !== "auto");
      case "lactate":
        if (unit === "mg/dL") return makeResult(field, value, unit, value / 9, "mmol/L", "", true);
        if (unit === "mEq/L" || unit === "mmol/L") return makeResult(field, value, unit, value, "mmol/L", unit === "mEq/L" ? "Lactate mEq/L treated as approximately mmol/L." : "", true);
        if (inRange(value, 0.2, 30)) return makeResult(field, value, "auto", value, "mmol/L", `Lactate ${value} assumed mmol/L. Select mg/dL if the lab reported mg/dL.`, false);
        return blocked(field, value, "auto", "Lactate unit is ambiguous.");
      case "albumin":
        if (unit === "g/L") return makeResult(field, value, unit, value, "g/L", "", true);
        if (unit === "g/dL") return makeResult(field, value, unit, value * 10, "g/L", "", true);
        if (inRange(value, 2, 6)) return makeResult(field, value, "auto", value * 10, "g/L", `Albumin ${value} likely g/dL; converted to ${round(value * 10)} g/L.`, false);
        if (inRange(value, 20, 60)) return makeResult(field, value, "auto", value, "g/L", `Albumin ${value} likely g/L.`, false);
        return blocked(field, value, "auto", "Albumin unit is ambiguous. Confirm g/L or g/dL.");
      case "glucose":
        if (unit === "mg/dL") return makeResult(field, value, unit, value / 18, "mmol/L", "", true);
        if (unit === "mmol/L") return makeResult(field, value, unit, value, "mmol/L", "", true);
        if (inRange(value, 3, 30)) return makeResult(field, value, "auto", value, "mmol/L", `Glucose ${value} likely mmol/L.`, false);
        if (inRange(value, 40, 600)) return makeResult(field, value, "auto", value / 18, "mmol/L", `Glucose ${value} likely mg/dL; converted to ${round(value / 18, 1)} mmol/L.`, false);
        return blocked(field, value, "auto", "Glucose unit is ambiguous.");
      case "urea":
        if (unit === "urea_mmol_L") return makeResult(field, value, unit, value, "mmol/L", "", true);
        if (unit === "BUN_mg_dL") return makeResult(field, value, unit, value / 2.8, "mmol/L", "", true);
        if (unit === "urea_mg_dL") return makeResult(field, value, unit, value / 6, "mmol/L", "", true);
        return blocked(field, value, "auto", "Urea/BUN unit must be confirmed before osmolal gap calculation.");
      case "creatinine":
        if (unit === "mg/dL") return makeResult(field, value, unit, value, "mg/dL", "", true);
        if (unit === "micromol/L") return makeResult(field, value, unit, value / 88.4, "mg/dL", "", true);
        if (inRange(value, 0.3, 15)) return makeResult(field, value, "auto", value, "mg/dL", `Creatinine ${value} likely mg/dL.`, false);
        if (inRange(value, 30, 1200)) return makeResult(field, value, "auto", value / 88.4, "mg/dL", `Creatinine ${value} likely micromol/L; converted to ${round(value / 88.4, 2)} mg/dL.`, false);
        return blocked(field, value, "auto", "Creatinine unit is ambiguous.");
      case "betaHydroxybutyrate":
        if (unit === "mg/dL") return makeResult(field, value, unit, value / 10.4, "mmol/L", "", true);
        return makeResult(field, value, unit, value, "mmol/L", "", unit !== "auto");
      case "phosphate":
        if (unit === "mg/dL") return makeResult(field, value, unit, value / 3.1, "mmol/L", "", true);
        return makeResult(field, value, unit, value, "mmol/L", "", unit !== "auto");
      case "calcium":
        if (unit === "mg/dL") return makeResult(field, value, unit, value / 4, "mmol/L", "", true);
        return makeResult(field, value, unit, value, "mmol/L", "", unit !== "auto");
      case "magnesium":
        if (unit === "mg/dL") return makeResult(field, value, unit, value / 2.43, "mmol/L", "", true);
        return makeResult(field, value, unit, value, "mmol/L", "", unit !== "auto");
      default:
        return makeResult(field, value, unit, value, INTERNAL_UNITS[field] || "", "", unit !== "auto");
    }
  }

  function normalize(raw) {
    const converted = {};
    const warnings = [];
    const blockedCalculations = [];
    Object.keys(INTERNAL_UNITS).concat(["age"]).forEach((field) => {
      if (!raw[field] || raw[field].value === "") {
        converted[field] = makeResult(field, NaN, raw[field]?.unit || "", NaN, INTERNAL_UNITS[field] || "", "", false);
        return;
      }
      converted[field] = convertField(field, raw[field].value, raw[field].unit);
      if (converted[field].warning) warnings.push(converted[field].warning);
    });

    if (raw.sampleType) converted.sampleType = raw.sampleType;
    return { converted, warnings, blockedCalculations };
  }

  function validate(v) {
    const danger = [];
    const validation = [];
    const impossible = [
      ["pH", v.pH.value, 6.7, 7.8, "pH"],
      ["paCO2", v.paCO2.value, 5, 150, "PaCO2"],
      ["hco3", v.hco3.value, 2, 60, "HCO3"],
      ["sodium", v.sodium.value, 100, 180, "Sodium"],
      ["chloride", v.chloride.value, 60, 140, "Chloride"],
      ["lactate", v.lactate.value, 0, 30, "Lactate"]
    ];

    impossible.forEach(([field, value, min, max, label]) => {
      if (has(value) && !inRange(value, min, max)) {
        validation.push(`${label} is outside the validation range. Recheck value and unit.`);
      }
    });

    if (has(v.pH.value) && v.pH.value < 7.2) danger.push("pH <7.20: severe acidemia.");
    if (has(v.pH.value) && v.pH.value > 7.6) danger.push("pH >7.60: severe alkalemia.");
    if (has(v.pH.value) && (v.pH.value < 7.1 || v.pH.value > 7.65)) danger.push("Critical pH danger range.");
    if (has(v.lactate.value) && v.lactate.value >= 4) danger.push("Lactate >=4 mmol/L: severe hyperlactatemia.");
    if (has(v.pH.value) && has(v.paCO2.value) && v.pH.value < 7.38 && v.paCO2.value > 42) {
      danger.push("Acidemia with high PaCO2: possible ventilatory failure.");
    }
    return { danger, validation };
  }

  function classifyPH(pH) {
    if (!has(pH)) return "pH unavailable";
    if (pH < 7.38) return "Acidemia";
    if (pH <= 7.42) return "Near-normal pH";
    return "Alkalemia";
  }

  function tendencies(v) {
    return {
      metabolicAcidosis: has(v.hco3.value) && v.hco3.value < 22,
      metabolicAlkalosis: has(v.hco3.value) && v.hco3.value > 26,
      respiratoryAcidosis: has(v.paCO2.value) && v.paCO2.value > 42,
      respiratoryAlkalosis: has(v.paCO2.value) && v.paCO2.value < 38
    };
  }

  function primaryInterpretation(v, metabolic) {
    const pHStatus = classifyPH(v.pH.value);
    const t = tendencies(v);
    const disorders = [];
    const notes = [];
    const tags = [];

    if (pHStatus === "Acidemia") {
      if (t.metabolicAcidosis && t.respiratoryAcidosis) disorders.push("Mixed metabolic acidosis plus respiratory acidosis");
      else if (t.metabolicAcidosis) disorders.push("Primary metabolic acidosis");
      else if (t.respiratoryAcidosis) disorders.push("Primary respiratory acidosis");
      else disorders.push("Acidemia without a matching HCO3/PaCO2 pattern");
      tags.push("acid");
    } else if (pHStatus === "Alkalemia") {
      if (t.metabolicAlkalosis && t.respiratoryAlkalosis) disorders.push("Mixed metabolic alkalosis plus respiratory alkalosis");
      else if (t.metabolicAlkalosis) disorders.push("Primary metabolic alkalosis");
      else if (t.respiratoryAlkalosis) disorders.push("Primary respiratory alkalosis");
      else disorders.push("Alkalemia without a matching HCO3/PaCO2 pattern");
      tags.push("alkali");
    } else if (pHStatus === "Near-normal pH") {
      const abnormal = [
        t.metabolicAcidosis && "metabolic acidosis tendency",
        t.metabolicAlkalosis && "metabolic alkalosis tendency",
        t.respiratoryAcidosis && "respiratory acidosis tendency",
        t.respiratoryAlkalosis && "respiratory alkalosis tendency",
        has(v.sbe.value) && Math.abs(v.sbe.value) > 2 && "abnormal base excess",
        metabolic.anionGapCategory && metabolic.anionGapCategory !== "normal anion gap" && "abnormal anion gap",
        has(v.lactate.value) && v.lactate.value > 2 && "elevated lactate"
      ].filter(Boolean);
      if (abnormal.length) {
        disorders.push("Near-normal pH with compensated or mixed acid-base disorder");
        notes.push(`Do not report as normal ABG: ${abnormal.join(", ")}.`);
        tags.push("warn");
      } else {
        disorders.push("No major acid-base disorder detected by available required values");
      }
    } else {
      disorders.push("Insufficient required values for primary interpretation");
      tags.push("warn");
    }

    return { pHStatus, disorders, notes, tags, tendencies: t };
  }

  function compareMeasured(measured, low, high, highText, lowText, okText) {
    if (!has(measured) || !has(low) || !has(high)) return "";
    if (measured > high) return highText;
    if (measured < low) return lowText;
    return okText;
  }

  function compensation(v, primary) {
    const lines = [];
    const expected = {};
    const hco3 = v.hco3.value;
    const paCO2 = v.paCO2.value;
    const t = primary.tendencies;

    if (t.metabolicAcidosis && has(hco3)) {
      const center = 1.5 * hco3 + 8;
      expected.expected_PaCO2_metabolic_acidosis = `${round(center - 2)}-${round(center + 2)} mmHg`;
      lines.push(compareMeasured(
        paCO2,
        center - 2,
        center + 2,
        `Winter formula predicts PaCO2 ${round(center - 2)}-${round(center + 2)} mmHg; measured ${round(paCO2)} is higher, suggesting additional respiratory acidosis.`,
        `Winter formula predicts PaCO2 ${round(center - 2)}-${round(center + 2)} mmHg; measured ${round(paCO2)} is lower, suggesting additional respiratory alkalosis.`,
        `Winter formula predicts PaCO2 ${round(center - 2)}-${round(center + 2)} mmHg; measured ${round(paCO2)} is within expected compensation.`
      ));
    }

    if (t.metabolicAlkalosis && has(hco3)) {
      const center = 0.7 * (hco3 - 24) + 40;
      expected.expected_PaCO2_metabolic_alkalosis = `${round(center - 2)}-${round(center + 2)} mmHg`;
      lines.push(compareMeasured(
        paCO2,
        center - 2,
        center + 2,
        `Expected PaCO2 for metabolic alkalosis is ${round(center - 2)}-${round(center + 2)} mmHg; measured ${round(paCO2)} is higher, suggesting additional respiratory acidosis.`,
        `Expected PaCO2 for metabolic alkalosis is ${round(center - 2)}-${round(center + 2)} mmHg; measured ${round(paCO2)} is lower, suggesting additional respiratory alkalosis.`,
        `Measured PaCO2 fits expected compensation for metabolic alkalosis, noting compensation is less predictable.`
      ));
    }

    if (t.respiratoryAcidosis && has(paCO2)) {
      const acute = 24 + 1 * ((paCO2 - 40) / 10);
      const chronic = 24 + 4 * ((paCO2 - 40) / 10);
      expected.expected_HCO3_respiratory_acidosis_acute = `${round(acute)} mmol/L`;
      expected.expected_HCO3_respiratory_acidosis_chronic = `${round(chronic)} mmol/L`;
      if (has(hco3)) {
        if (hco3 < acute - 2) lines.push(`HCO3 ${round(hco3)} is below expected acute respiratory acidosis compensation, suggesting additional metabolic acidosis.`);
        else if (hco3 > chronic + 2) lines.push(`HCO3 ${round(hco3)} is above expected chronic respiratory acidosis compensation, suggesting additional metabolic alkalosis.`);
        else lines.push(`HCO3 ${round(hco3)} lies between acute (${round(acute)}) and chronic (${round(chronic)}) respiratory acidosis compensation estimates.`);
      }
    }

    if (t.respiratoryAlkalosis && has(paCO2)) {
      const acute = 24 - 2 * ((40 - paCO2) / 10);
      const chronic = 24 - 4 * ((40 - paCO2) / 10);
      expected.expected_HCO3_respiratory_alkalosis_acute = `${round(acute)} mmol/L`;
      expected.expected_HCO3_respiratory_alkalosis_chronic = `${round(chronic)} mmol/L`;
      if (has(hco3)) {
        if (hco3 < chronic - 2) lines.push(`HCO3 ${round(hco3)} is below expected chronic respiratory alkalosis compensation, suggesting additional metabolic acidosis.`);
        else if (hco3 > acute + 2) lines.push(`HCO3 ${round(hco3)} is above expected acute respiratory alkalosis compensation, suggesting additional metabolic alkalosis.`);
        else lines.push(`HCO3 ${round(hco3)} lies between acute (${round(acute)}) and chronic (${round(chronic)}) respiratory alkalosis compensation estimates.`);
      }
    }

    return { lines: lines.filter(Boolean), expected };
  }

  function metabolicAnalysis(v, settings) {
    const agUpper = Number(settings.agUpperLimit) || 12;
    const result = {
      anionGap: NaN,
      correctedAnionGap: NaN,
      anionGapCategory: "",
      deltaAG: NaN,
      deltaHCO3: NaN,
      deltaGap: NaN,
      deltaInterpretation: "",
      lactateDeltaCheck: NaN,
      lactateDeltaInterpretation: "",
      calculatedOsmolality: NaN,
      osmolalGap: NaN,
      osmolalInterpretation: "",
      urinaryAnionGap: NaN,
      urineInterpretation: "",
      alkalosisInterpretation: "",
      albuminCorrectionBlocked: false
    };

    if (has(v.sodium.value) && has(v.chloride.value) && has(v.hco3.value)) {
      result.anionGap = v.sodium.value - (v.chloride.value + v.hco3.value);
      if (has(v.albumin.value) && !v.albumin.confirmed) {
        result.albuminCorrectionBlocked = true;
        result.anionGapCategory = "albumin correction blocked";
      } else {
        result.correctedAnionGap = result.anionGap;
        if (has(v.albumin.value)) result.correctedAnionGap = result.anionGap + 0.25 * (40 - v.albumin.value);
        if (result.correctedAnionGap > agUpper) result.anionGapCategory = "high anion gap";
        else if (result.correctedAnionGap < 3) result.anionGapCategory = "low anion gap";
        else result.anionGapCategory = "normal anion gap";
        result.deltaAG = result.correctedAnionGap - agUpper;
        result.deltaHCO3 = 24 - v.hco3.value;
        result.deltaGap = result.deltaAG - result.deltaHCO3;
      }

      if (result.correctedAnionGap > agUpper) {
        if (result.deltaGap > 5) result.deltaInterpretation = "High anion gap metabolic acidosis plus metabolic alkalosis.";
        else if (result.deltaGap < -5) result.deltaInterpretation = "High anion gap metabolic acidosis plus normal anion gap acidosis.";
        else result.deltaInterpretation = "Delta gap fits simple high anion gap metabolic acidosis.";
        result.lactateDeltaCheck = 0.6 * result.deltaAG - result.deltaHCO3;
        if (result.lactateDeltaCheck > 5) result.lactateDeltaInterpretation = "Lactic acidosis plus metabolic alkalosis pattern.";
        else if (result.lactateDeltaCheck < -5) result.lactateDeltaInterpretation = "Lactic acidosis plus normal anion gap acidosis pattern.";
        else result.lactateDeltaInterpretation = "Lactate can plausibly explain the high anion gap pattern.";
      }
    }

    if (has(v.measuredOsmolality.value) && has(v.sodium.value) && has(v.glucose.value) && has(v.urea.value)) {
      if (v.glucose.confirmed && v.urea.confirmed) {
        result.calculatedOsmolality = 2 * v.sodium.value + v.glucose.value + v.urea.value;
        result.osmolalGap = v.measuredOsmolality.value - result.calculatedOsmolality;
        result.osmolalInterpretation = result.osmolalGap > 10
          ? "Osmolal gap is elevated; toxic alcohols are important but not the only cause."
          : "Osmolal gap is not elevated by the >10 mOsm/kg threshold.";
      }
    }

    if (has(v.urineSodium.value) && has(v.urinePotassium.value) && has(v.urineChloride.value)) {
      result.urinaryAnionGap = v.urineSodium.value + v.urinePotassium.value - v.urineChloride.value;
      if (result.urinaryAnionGap < 0) result.urineInterpretation = "Negative urinary anion gap suggests appropriate ammonium excretion, often gastrointestinal bicarbonate loss.";
      else result.urineInterpretation = "Positive urinary anion gap suggests impaired renal acid excretion or renal failure.";
    }

    if (has(v.urineChloride.value)) {
      if (v.urineChloride.value < 20) result.alkalosisInterpretation = "Urine chloride <20 mmol/L: chloride-responsive metabolic alkalosis pattern.";
      else if (v.urineChloride.value >= 25) result.alkalosisInterpretation = "Urine chloride >=25 mmol/L: chloride-resistant or renal chloride-wasting alkalosis pattern.";
      else result.alkalosisInterpretation = "Urine chloride is borderline for alkalosis classification.";
    }

    return result;
  }

  function stewartLight(v) {
    const out = {
      eligible: false,
      Na_minus_Cl: NaN,
      reference_Na_minus_Cl: NaN,
      SBE_SID: NaN,
      SBE_albumin: NaN,
      SBE_unmeasured_ions: NaN,
      SBE_unmeasured_ions_after_lactate: NaN,
      interpretation: [],
      blockedReason: ""
    };

    const required = ["sbe", "sodium", "chloride", "albumin", "lactate"];
    const missing = required.filter((field) => !has(v[field].value));
    if (missing.length) {
      out.blockedReason = `Stewart light blocked until ${missing.join(", ")} available and units confirmed.`;
      return out;
    }
    if (!v.albumin.confirmed) {
      out.blockedReason = "Stewart light blocked until albumin unit is explicitly confirmed.";
      return out;
    }

    out.eligible = true;
    out.Na_minus_Cl = v.sodium.value - v.chloride.value;
    out.reference_Na_minus_Cl = has(v.pH.value) && (v.pH.value < 7.3 || v.pH.value > 7.5)
      ? 35 + 15 * (7.4 - v.pH.value)
      : 35;
    out.SBE_SID = out.Na_minus_Cl - out.reference_Na_minus_Cl;
    out.SBE_albumin = 0.3 * (40 - v.albumin.value);
    out.SBE_unmeasured_ions = v.sbe.value - out.SBE_SID - out.SBE_albumin;
    out.SBE_unmeasured_ions_after_lactate = out.SBE_unmeasured_ions + v.lactate.value;

    if (out.SBE_SID < -0.5) out.interpretation.push("Negative SBE_SID: strong ion acidosis, usually hyperchloremic or low-SID acidosis.");
    else if (out.SBE_SID > 0.5) out.interpretation.push("Positive SBE_SID: strong ion alkalosis, usually hypochloremic or high-SID alkalosis.");
    else out.interpretation.push("SBE_SID is near neutral.");

    if (out.SBE_albumin > 0.5) out.interpretation.push("Positive albumin effect: hypoalbuminemic alkalosis.");
    else if (out.SBE_albumin < -0.5) out.interpretation.push("Negative albumin effect: hyperalbuminemic acidosis.");
    else out.interpretation.push("Albumin effect is near neutral.");

    if (out.SBE_unmeasured_ions < -0.5) out.interpretation.push("Negative SBE_UI: unmeasured anion acidosis.");
    else if (out.SBE_unmeasured_ions > 0.5) out.interpretation.push("Positive SBE_UI: possible unmeasured cation effect or measurement issue.");
    else out.interpretation.push("Unmeasured ion effect is near neutral.");

    if (out.SBE_unmeasured_ions_after_lactate < -0.5) out.interpretation.push("Residual after lactate remains negative: consider ketones, uremic anions, toxins, phosphate/sulfate, pyroglutamate, or other fixed acids.");
    else out.interpretation.push("Residual after lactate is near neutral or positive.");

    return out;
  }

  function alacticBaseExcess(v) {
    const out = { SBE: v.sbe.value, lactate: v.lactate.value, ABE: NaN, interpretation: "" };
    if (!has(v.sbe.value) || !has(v.lactate.value)) {
      out.interpretation = "Alactic base excess requires SBE and lactate in mmol/L.";
      return out;
    }
    out.ABE = v.sbe.value + v.lactate.value;
    if (out.ABE < -5) out.interpretation = "Significant non-lactate fixed-acid burden.";
    else if (out.ABE < -2) out.interpretation = "Non-lactate metabolic acidosis.";
    else if (out.ABE > 2) out.interpretation = "Non-lactate alkalinizing component.";
    else out.interpretation = "Near-neutral non-lactate metabolic component.";
    return out;
  }

  function oxygenation(v, settings) {
    const out = { A_a_gradient: NaN, PAO2: NaN, interpretation: "", blockedReason: "" };
    if (v.sampleType !== "arterial") {
      out.blockedReason = "A-a gradient blocked: oxygenation interpretation requires an arterial sample.";
      return out;
    }
    const required = ["paO2", "paCO2", "fio2"];
    const missing = required.filter((field) => !has(v[field].value));
    if (missing.length) {
      out.blockedReason = `A-a gradient blocked until ${missing.join(", ")} is available.`;
      return out;
    }
    if (!v.paO2.confirmed || !v.paCO2.confirmed || !v.fio2.confirmed) {
      out.blockedReason = "A-a gradient blocked until PaO2, PaCO2, and FiO2 units are confirmed.";
      return out;
    }
    const pb = Number(settings.barometricPressure) || 760;
    const rq = Number(settings.respiratoryQuotient) || 0.8;
    out.PAO2 = v.fio2.value * (pb - 47) - v.paCO2.value / rq;
    out.A_a_gradient = out.PAO2 - v.paO2.value;
    const elderly = has(v.age.value) && v.age.value >= 65;
    const limit = elderly ? 20 : 10;
    if (out.A_a_gradient <= limit) out.interpretation = `A-a gradient is within the ${limit} mmHg screening threshold.`;
    else if (out.A_a_gradient <= 20) out.interpretation = "A-a gradient is mildly elevated for young adults but may be acceptable in elderly patients.";
    else out.interpretation = "Elevated A-a gradient suggests V/Q mismatch, diffusion limitation, shunt, pneumonia, edema, ARDS, PE, or related pathology.";
    return out;
  }

  function likelyCauses(v, primary, metabolic, stewart, abe, flags) {
    const causes = [];
    const tests = new Set();
    const add = (cause) => {
      if (cause && !causes.includes(cause)) causes.push(cause);
    };
    const addTests = (items) => items.forEach((item) => tests.add(item));

    if (metabolic.anionGapCategory === "high anion gap") {
      add("High anion gap causes: glycols, 5-oxoproline, L-lactate, D-lactate, methanol, aspirin/salicylate, renal failure, rhabdomyolysis, ketoacidosis.");
      addTests(["beta-hydroxybutyrate", "renal function", "measured serum osmolality", "salicylate level", "toxic alcohol screen", "urine microscopy", "liver function", "creatine kinase"]);
    }
    if (has(v.lactate.value) && v.lactate.value >= 4) {
      add("Severe hyperlactatemia: consider shock, sepsis, tissue hypoperfusion, liver failure, seizures, or medications/toxins.");
      addTests(["repeat lactate", "source control assessment", "perfusion markers"]);
    }
    if (has(metabolic.osmolalGap) && metabolic.osmolalGap > 10) {
      add("High osmolal gap with acidosis raises toxic alcohol concern, while DKA, alcoholic ketoacidosis, and lactic acidosis remain possible.");
      addTests(["ethanol level", "methanol/ethylene glycol level", "repeat osmolality", "lactate gap check"]);
    }
    if (primary.tendencies.metabolicAcidosis && (metabolic.anionGapCategory === "normal anion gap" || metabolic.anionGapCategory === "low anion gap")) {
      add("Normal anion gap acidosis: consider saline/hyperchloremia, diarrhea, renal tubular acidosis, renal failure, ureteric diversion, acetazolamide/topiramate.");
      addTests(["urine sodium/potassium/chloride", "urine pH", "renal function", "medication review"]);
    }
    if (metabolic.anionGapCategory === "low anion gap") {
      add("Low or negative anion gap: recheck sodium/chloride/bicarbonate, consider marked hyperchloremia, hypoalbuminemia, paraproteins, lithium/bromide exposure, or analyzer/sample issue.");
      addTests(["repeat electrolytes", "albumin", "total protein", "medication/toxin review"]);
    }
    if (primary.tendencies.metabolicAlkalosis) {
      if (has(v.urineChloride.value) && v.urineChloride.value < 20) add("Chloride-responsive metabolic alkalosis: vomiting, nasogastric suction, remote diuretics, post-hypercapnic alkalosis.");
      if (has(v.urineChloride.value) && v.urineChloride.value >= 25) add("Chloride-resistant or renal chloride-wasting alkalosis: active diuretics, Bartter/Gitelman, mineralocorticoid excess, severe hypokalemia or magnesium deficiency.");
      addTests(["urine chloride", "potassium", "magnesium", "blood pressure", "renin/aldosterone if indicated", "diuretic history"]);
    }
    if (stewart.eligible && stewart.SBE_unmeasured_ions_after_lactate < -0.5) {
      add("Stewart residual non-lactate unmeasured anion effect: evaluate ketones, renal acids, toxins, phosphate/sulfate, and pyroglutamate risk.");
      addTests(["ketones", "phosphate", "toxicology", "pyroglutamate risk review"]);
    }
    if (has(abe.ABE) && abe.ABE < -2) {
      add("Alactic base excess suggests non-lactate fixed-acid burden.");
      addTests(["renal function", "ketones", "toxin screen", "phosphate/sulfate if available"]);
    }

    Object.keys(flags || {}).forEach((key) => {
      if (!flags[key]) return;
      const label = FLAG_LABELS[key] || key;
      if (key === "vomiting") add("Clinical flag: vomiting supports chloride-responsive alkalosis.");
      else if (key === "diarrhea") add("Clinical flag: diarrhea supports gastrointestinal bicarbonate loss.");
      else if (key === "renalFailure") add("Clinical flag: renal failure supports uremic acidosis or impaired acid excretion.");
      else if (key === "toxicAlcohol") add("Clinical flag: toxic alcohol suspicion requires osmolal gap/toxicology correlation.");
      else add(`Clinical flag: ${label}.`);
    });

    return { causes, recommendedMissingTests: Array.from(tests) };
  }

  function lineItems(v, primary, metabolic, compensationResult, stewart, abe, oxy) {
    const lines = [];
    lines.push(`${primary.pHStatus}.`);
    primary.disorders.forEach((item) => lines.push(item + "."));
    primary.notes.forEach((item) => lines.push(item));
    compensationResult.lines.forEach((item) => lines.push(item));
    if (has(metabolic.correctedAnionGap)) {
      lines.push(`Corrected anion gap is ${round(metabolic.correctedAnionGap)} mmol/L: ${metabolic.anionGapCategory}.`);
    } else if (has(metabolic.anionGap) && metabolic.albuminCorrectionBlocked) {
      lines.push(`Uncorrected anion gap is ${round(metabolic.anionGap)} mmol/L; corrected anion gap is blocked until albumin unit is confirmed.`);
    }
    if (metabolic.deltaInterpretation) lines.push(metabolic.deltaInterpretation);
    if (metabolic.lactateDeltaInterpretation) lines.push(metabolic.lactateDeltaInterpretation);
    if (stewart.eligible) {
      lines.push(`Stewart light: SBE_SID ${round(stewart.SBE_SID)}, SBE_Alb ${round(stewart.SBE_albumin)}, SBE_UI ${round(stewart.SBE_unmeasured_ions)}, residual after lactate ${round(stewart.SBE_unmeasured_ions_after_lactate)}.`);
    } else if (stewart.blockedReason) {
      lines.push(stewart.blockedReason);
    }
    if (has(abe.ABE)) lines.push(`Alactic base excess is ${round(abe.ABE)} mmol/L: ${abe.interpretation}`);
    if (has(oxy.A_a_gradient)) lines.push(`A-a gradient is ${round(oxy.A_a_gradient)} mmHg: ${oxy.interpretation}`);
    else if (oxy.blockedReason) lines.push(oxy.blockedReason);
    return lines;
  }

  function stepwiseInterpretation(v, primary, metabolic, compensationResult, abe, oxy, causes, settings) {
    const steps = [];
    const calculations = [];
    const ph = v.pH.value;
    const paCO2 = v.paCO2.value;
    const hco3 = v.hco3.value;
    const sbe = v.sbe.value;
    const lactate = v.lactate.value;

    if (has(ph)) {
      const severity = ph < 7.2 ? "severe " : "";
      steps.push(`pH ${round(ph, 3)} shows ${severity}${primary.pHStatus.toLowerCase()}.`);
    } else {
      steps.push("pH is missing, so acidemia/alkalemia cannot be classified.");
    }

    if (has(hco3) || has(sbe)) {
      const metabolicParts = [];
      if (has(hco3)) metabolicParts.push(`HCO3 ${round(hco3)} mmol/L`);
      if (has(sbe)) metabolicParts.push(`base excess ${round(sbe)} mmol/L`);
      if (primary.tendencies.metabolicAcidosis) steps.push(`${metabolicParts.join(" and ")} indicate a metabolic acidosis component.`);
      else if (primary.tendencies.metabolicAlkalosis) steps.push(`${metabolicParts.join(" and ")} indicate a metabolic alkalosis component.`);
      else steps.push(`${metabolicParts.join(" and ")} do not show a major metabolic component by the default thresholds.`);
    }

    if (has(paCO2)) {
      if (primary.tendencies.respiratoryAcidosis) steps.push(`PaCO2 ${round(paCO2)} mmHg is high, adding a respiratory acidosis component.`);
      else if (primary.tendencies.respiratoryAlkalosis) steps.push(`PaCO2 ${round(paCO2)} mmHg is low, adding a respiratory alkalosis component.`);
      else steps.push(`PaCO2 ${round(paCO2)} mmHg is in the expected screening range for ventilation.`);
    }

    compensationResult.lines.forEach((line) => steps.push(line));

    if (has(metabolic.correctedAnionGap)) {
      const albuminText = has(v.albumin.value)
        ? `albumin-corrected anion gap is ${round(metabolic.correctedAnionGap, 2)} mmol/L`
        : `anion gap is ${round(metabolic.correctedAnionGap, 2)} mmol/L without albumin correction`;
      steps.push(`${albuminText}, which is ${metabolic.anionGapCategory}.`);
    } else if (has(metabolic.anionGap)) {
      steps.push(`Uncorrected anion gap is ${round(metabolic.anionGap, 2)} mmol/L; albumin correction is not available.`);
    }

    if (has(lactate)) {
      if (lactate >= 4) steps.push(`Lactate ${round(lactate, 2)} mmol/L is severe hyperlactatemia and can drive lactic metabolic acidosis.`);
      else if (lactate > 2) steps.push(`Lactate ${round(lactate, 2)} mmol/L is elevated and may contribute to metabolic acidosis.`);
      else steps.push(`Lactate ${round(lactate, 2)} mmol/L is not elevated by the usual screening threshold.`);
    }

    if (has(abe.ABE)) steps.push(`Alactic base excess is ${round(abe.ABE, 2)} mmol/L, so ${abe.interpretation.toLowerCase()}`);
    if (has(oxy.A_a_gradient)) steps.push(`A-a gradient is ${round(oxy.A_a_gradient, 2)} mmHg; ${oxy.interpretation}`);
    else if (oxy.blockedReason) steps.push(oxy.blockedReason);

    if (has(v.sodium.value) && has(v.chloride.value) && has(v.hco3.value)) {
      calculations.push(`Anion gap = Na - (Cl + HCO3) = ${round(v.sodium.value, 2)} - (${round(v.chloride.value, 2)} + ${round(v.hco3.value, 2)}) = ${round(metabolic.anionGap, 2)} mmol/L.`);
      if (has(v.albumin.value)) {
        calculations.push(`Albumin-corrected AG = AG + 0.25 x (40 - albumin g/L) = ${round(metabolic.anionGap, 2)} + 0.25 x (40 - ${round(v.albumin.value, 2)}) = ${round(metabolic.correctedAnionGap, 2)} mmol/L.`);
      } else {
        calculations.push("Albumin was not entered, so the displayed anion gap is uncorrected. Add albumin if available for albumin-corrected AG.");
      }
    }

    if (primary.tendencies.metabolicAcidosis && has(hco3)) {
      const center = 1.5 * hco3 + 8;
      calculations.push(`Winter formula = 1.5 x HCO3 + 8 +/- 2 = 1.5 x ${round(hco3, 2)} + 8 +/- 2 = expected PaCO2 ${round(center - 2, 2)}-${round(center + 2, 2)} mmHg.`);
    }

    if (metabolic.deltaInterpretation) {
      calculations.push(`Delta gap = (corrected AG - upper limit) - (24 - HCO3) = ${round(metabolic.deltaAG, 2)} - ${round(metabolic.deltaHCO3, 2)} = ${round(metabolic.deltaGap, 2)}; ${metabolic.deltaInterpretation}`);
    }

    if (has(abe.ABE)) {
      calculations.push(`Alactic base excess = SBE + lactate = ${round(sbe, 2)} + ${round(lactate, 2)} = ${round(abe.ABE, 2)} mmol/L.`);
    }

    if (has(oxy.PAO2) && has(oxy.A_a_gradient)) {
      const pb = Number(settings.barometricPressure) || 760;
      const rq = Number(settings.respiratoryQuotient) || 0.8;
      calculations.push(`Alveolar PO2 = FiO2 x (barometric pressure - 47) - PaCO2/RQ = ${round(v.fio2.value, 2)} x (${pb} - 47) - ${round(v.paCO2.value, 2)}/${rq} = ${round(oxy.PAO2, 2)} mmHg.`);
      calculations.push(`A-a gradient = alveolar PO2 - PaO2 = ${round(oxy.PAO2, 2)} - ${round(v.paO2.value, 2)} = ${round(oxy.A_a_gradient, 2)} mmHg.`);
    }

    return {
      interpretation_steps: steps,
      calculations,
      possible_reasons: causes.causes
    };
  }

  function analyze(raw, settings = {}) {
    const normalized = normalize(raw);
    const v = normalized.converted;
    const validation = validate(v);
    const metabolic = metabolicAnalysis(v, settings);
    const primary = primaryInterpretation(v, metabolic);
    const compensationResult = compensation(v, primary);
    const stewart = stewartLight(v);
    const abe = alacticBaseExcess(v);
    const oxy = oxygenation(v, settings);
    const causes = likelyCauses(v, primary, metabolic, stewart, abe, raw.flags || {});
    const finalDiagnosis = lineItems(v, primary, metabolic, compensationResult, stewart, abe, oxy);
    const stepwise = stepwiseInterpretation(v, primary, metabolic, compensationResult, abe, oxy, causes, settings);

    const blockedCalculations = [];
    if (!has(metabolic.osmolalGap) && has(v.measuredOsmolality.value)) {
      if (!has(v.glucose.value) || !has(v.urea.value) || !v.glucose.confirmed || !v.urea.confirmed) {
        blockedCalculations.push("Osmolal gap blocked until glucose and urea/BUN units are confirmed.");
      }
    }
    if (metabolic.albuminCorrectionBlocked) blockedCalculations.push("Corrected anion gap blocked until albumin unit is explicitly confirmed.");
    if (stewart.blockedReason) blockedCalculations.push(stewart.blockedReason);
    if (oxy.blockedReason) blockedCalculations.push(oxy.blockedReason);

    return {
      severity: {
        pH_status: primary.pHStatus,
        danger_flags: validation.danger
      },
      unit_normalization: {
        raw_inputs: raw,
        converted_inputs: Object.fromEntries(Object.entries(v).map(([key, item]) => [key, item && typeof item === "object" && "value" in item ? {
          value: has(item.value) ? round(item.value, 3) : "",
          unit: item.internalUnit || item.rawUnit || "",
          raw_value: has(item.rawValue) ? item.rawValue : "",
          raw_unit: item.rawUnit || "",
          confirmed: item.confirmed
        } : item])),
        unit_warnings: normalized.warnings,
        blocked_calculations: blockedCalculations
      },
      validation_warnings: validation.validation,
      primary_interpretation: {
        primary_disorders: primary.disorders,
        compensation_status: compensationResult.lines.join(" "),
        expected_values: compensationResult.expected
      },
      metabolic_analysis: {
        anion_gap: has(metabolic.anionGap) ? round(metabolic.anionGap, 2) : "",
        corrected_anion_gap: has(metabolic.correctedAnionGap) ? round(metabolic.correctedAnionGap, 2) : "",
        anion_gap_category: metabolic.anionGapCategory,
        delta_AG: has(metabolic.deltaAG) ? round(metabolic.deltaAG, 2) : "",
        delta_HCO3: has(metabolic.deltaHCO3) ? round(metabolic.deltaHCO3, 2) : "",
        delta_interpretation: metabolic.deltaInterpretation,
        lactate_delta_check: has(metabolic.lactateDeltaCheck) ? round(metabolic.lactateDeltaCheck, 2) : "",
        lactate_delta_interpretation: metabolic.lactateDeltaInterpretation,
        calculated_osmolality: has(metabolic.calculatedOsmolality) ? round(metabolic.calculatedOsmolality, 2) : "",
        osmolal_gap: has(metabolic.osmolalGap) ? round(metabolic.osmolalGap, 2) : "",
        osmolal_interpretation: metabolic.osmolalInterpretation,
        urinary_anion_gap: has(metabolic.urinaryAnionGap) ? round(metabolic.urinaryAnionGap, 2) : "",
        urine_interpretation: metabolic.urineInterpretation,
        alkalosis_interpretation: metabolic.alkalosisInterpretation,
        albumin_correction_blocked: metabolic.albuminCorrectionBlocked
      },
      stewart_light: {
        Na_minus_Cl: has(stewart.Na_minus_Cl) ? round(stewart.Na_minus_Cl, 2) : "",
        reference_Na_minus_Cl: has(stewart.reference_Na_minus_Cl) ? round(stewart.reference_Na_minus_Cl, 2) : "",
        SBE_SID: has(stewart.SBE_SID) ? round(stewart.SBE_SID, 2) : "",
        SBE_albumin: has(stewart.SBE_albumin) ? round(stewart.SBE_albumin, 2) : "",
        SBE_unmeasured_ions: has(stewart.SBE_unmeasured_ions) ? round(stewart.SBE_unmeasured_ions, 2) : "",
        SBE_unmeasured_ions_after_lactate: has(stewart.SBE_unmeasured_ions_after_lactate) ? round(stewart.SBE_unmeasured_ions_after_lactate, 2) : "",
        interpretation: stewart.interpretation
      },
      alactic_base_excess: {
        SBE: has(abe.SBE) ? round(abe.SBE, 2) : "",
        lactate: has(abe.lactate) ? round(abe.lactate, 2) : "",
        ABE: has(abe.ABE) ? round(abe.ABE, 2) : "",
        interpretation: abe.interpretation
      },
      oxygenation: {
        PAO2: has(oxy.PAO2) ? round(oxy.PAO2, 2) : "",
        A_a_gradient: has(oxy.A_a_gradient) ? round(oxy.A_a_gradient, 2) : "",
        oxygenation_interpretation: oxy.interpretation || oxy.blockedReason
      },
      final_diagnosis: finalDiagnosis,
      stepwise_interpretation: stepwise,
      likely_causes: causes.causes,
      recommended_missing_tests: causes.recommendedMissingTests,
      clinical_warning: "Interpretation must be correlated with clinical context. This app does not replace clinician judgement."
    };
  }

  window.ABGEngine = {
    analyze,
    convertField,
    REQUIRED_FIELDS,
    FLAG_LABELS,
    round,
    has
  };
})();
