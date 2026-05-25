# DPlace/ CLAUDE.md

This is the DPlace-based crosstabulation tool for the Standard Cross-Cultural Sample (SCCS). It uses the full DPlace dataset (~1800 variables across 186 societies) rather than the original 86-variable EthnoAtlas subset.

## Running

Requires an HTTP server (ES6 module loading):
```bash
cd DPlace
python3 -m http.server 8000
```
Then open http://localhost:8000

`standalone.html` is a self-contained version that works offline but must be regenerated when data changes.

## Architecture

### JS Modules (ES6, imported by app.js)

- **app.js** — Main controller. Loads all data files, initializes components, handles crosstab generation and display. Selected variables stored in `selectedRowVar`/`selectedColVar` (sequential column numbers).
- **variablePicker.js** — Searchable modal for picking variables from ~1800 options. Category filter chips, text search, keyboard nav, preview pane with coverage counts, value codes, citations, and descriptions. Constructed with `(labelParser, dataParser, onSelect)`.
- **labelParser.js** — Parses `SCCS.lbl` (variable names + value labels) and `SCCS.varinfo` (category, type, citation, description, original SCCS number). Key accessors: `getVariableLabel()`, `getSccsNum()`, `getCategory()`, `getCitation()`, `getCategories()`.
- **dataParser.js** — Parses `SCCS.data` (186×N space-separated matrix, `.` = missing). Variables are 1-indexed externally, 0-indexed internally.
- **crosstab.js** — Crosstabulation engine with chi-square calculations and cell case tracking.
- **societyLookup.js** — Parses `SCCS.glbl` for society metadata (name, year, lat/long).

### Data Pipeline

`dplace-data/datasets/SCCS/` (CSV source) → `convert_sccs.py` → `resources/SCCS.*`

**convert_sccs.py** reads from `../dplace-data/datasets/SCCS/`:
- `variables.csv` — Variable metadata (id, category, title, definition, type, source)
- `codes.csv` — Value code descriptions
- `data.csv` — Long-format coded values (329K rows)
- `societies.csv` — Society metadata

And writes to `resources/`:
- `SCCS.data` — 186 rows × N cols, space-separated
- `SCCS.lbl` — AWK heredoc format (sequential column number → title + value labels)
- `SCCS.glbl` — Tab-separated society info
- `SCCS.varinfo` — Tab-separated: col, sccs_num, category, title, type, description, citation, source
- `badata.dat` — Anomaly report

### Numbering Convention

Variables have **two** numbering systems:
- **Sequential column number** — 1 to N, used internally by the data matrix and crosstab engine
- **Original SCCS number** — e.g. 860 from SCCS860, used for all display. Has gaps (SCCS1–SCCS2002 with ~220 gaps). Stored in `SCCS.varinfo` and accessed via `labelParser.getSccsNum()`.

### Data Files in resources/

`SCCS.*` files are hard-linked to `SCCS_Explorer/resources/`. Editing one modifies the other.

## Citation

The footer references: Murdock, G. P. and White, D. R. (1969). Standard cross-cultural sample. *Ethnology*, 8(4), 329–369. Variable-level citations are shown in the picker preview pane.

D-PLACE data should cite: Kirby et al. (2016). D-PLACE: A Global Database of Cultural, Linguistic and Environmental Diversity. *PLoS ONE*, 11(7): e0158391.
