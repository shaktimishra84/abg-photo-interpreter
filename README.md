# ABG Interpreter

Static, rule-based ABG interpretation app generated from `ABG_App_Definitive_Algorithm.docx`.

## Run locally

Open `index.html` in a browser, or serve the folder with any static web server.

Photo input uses browser OCR through Tesseract.js loaded from jsDelivr. The clinical calculator still runs locally in the browser, but OCR needs internet access unless the OCR library is bundled later.

Run the calculation smoke tests with:

```bash
node smoke-test.js
```

## Deploy

Deploy the whole folder as static assets. Required files:

- `index.html`
- `styles.css`
- `engine.js`
- `app.js`
- `package.json`
- `vercel.json`

`README.md`, `.gitignore`, `.nojekyll`, and `smoke-test.js` are useful for maintenance but are not required by the browser app.

For Vercel, import the GitHub repository as a static project. Framework preset can be `Other`; no build command is required; output directory is the repository root.

## Clinical scope

The engine performs deterministic calculations for unit normalization, danger checks, physiologic acid-base interpretation, compensation checks, anion gap and delta analysis, osmolal gap gating, urine indices, oxygenation, Stewart light base-excess partitioning, and alactic base excess. Any generative AI layer should only rewrite explanations and must not change the calculated diagnosis.

Photo OCR is a data-entry aid only. Users must review extracted values and units before relying on the report.
