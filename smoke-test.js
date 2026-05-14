const assert = require("assert");

global.window = global;
require("./engine.js");

const settings = { agUpperLimit: 12, barometricPressure: 760, respiratoryQuotient: 0.8 };

const mixedCase = {
  pH: { value: "7.12", unit: "unitless" },
  paCO2: { value: "38", unit: "mmHg" },
  paO2: { value: "78", unit: "mmHg" },
  fio2: { value: "0.21", unit: "fraction" },
  hco3: { value: "12", unit: "mmol/L" },
  sbe: { value: "-15", unit: "mmol/L" },
  sodium: { value: "140", unit: "mmol/L" },
  potassium: { value: "4.8", unit: "mmol/L" },
  chloride: { value: "112", unit: "mmol/L" },
  lactate: { value: "6", unit: "mmol/L" },
  albumin: { value: "2.4", unit: "g/dL" },
  age: { value: "62", unit: "years" },
  glucose: { value: "165", unit: "mg/dL" },
  urea: { value: "42", unit: "BUN_mg_dL" },
  measuredOsmolality: { value: "318", unit: "mOsm/kg" },
  sampleType: "arterial",
  flags: { sepsis: true, shock: true, renalFailure: true }
};

const report = global.ABGEngine.analyze(mixedCase, settings);
assert.strictEqual(report.severity.pH_status, "Acidemia");
assert.strictEqual(report.metabolic_analysis.corrected_anion_gap, 20);
assert.strictEqual(report.alactic_base_excess.ABE, -9);
assert.strictEqual(report.stewart_light.SBE_unmeasured_ions_after_lactate, -2.6);
assert(report.final_diagnosis.some((line) => line.includes("additional respiratory acidosis")));

const guessedAlbumin = global.ABGEngine.analyze({
  ...mixedCase,
  albumin: { value: "2.4", unit: "auto" }
}, settings);
assert.strictEqual(guessedAlbumin.metabolic_analysis.corrected_anion_gap, "");
assert(guessedAlbumin.unit_normalization.blocked_calculations.some((line) => line.includes("Corrected anion gap blocked")));
assert(guessedAlbumin.unit_normalization.blocked_calculations.some((line) => line.includes("Stewart light blocked")));

const venousCase = global.ABGEngine.analyze({
  ...mixedCase,
  sampleType: "venous"
}, settings);
assert(venousCase.oxygenation.oxygenation_interpretation.includes("arterial sample"));

console.log("ABG engine smoke tests passed.");
