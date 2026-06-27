# Standard Cross-Cultural Sample (SCCS) Crosstabulation Tool

A web-based tool for cross-tabulating variables from the Standard Cross-Cultural Sample, using the full DPlace dataset of nearly 2,000 variables across 186 societies.

## Features

- **Searchable Variable Picker** — Browse ~1,800 variables with text search, category filter chips, and keyboard navigation
- **Variable Preview** — See coverage counts, value codes, bibliographic citations, and descriptions before selecting
- **Crosstabulation** — Generate crosstab tables across 186 societies
- **Statistical Analysis** — Chi-square test of independence with observed-minus-expected and chi-square contribution tables
- **Color Coding** — Visual representation of cell frequencies
- **Cell Details** — Click any cell to see which societies fall in it
- **Dual Interface** — Both modular (HTTP server) and standalone (offline) versions

## Data

- **186 societies** from the Standard Cross-Cultural Sample
- **~1,800 variables** covering subsistence, economy, household, childhood, marriage, kinship, warfare, politics, religion, and more
- **Original SCCS variable numbers** preserved for reference with published codebooks
- Variable-level bibliographic citations shown in the picker

## Quick Start

```bash
cd DPlace
python3 -m http.server 8000
```

Then open http://localhost:8000

The standalone version can be opened directly in a browser:
```bash
open DPlace/standalone.html
```

## Project Structure

```
DPlace/                       # Main application (DPlace/SCCS dataset)
  app.js                      # Main application controller
  variablePicker.js           # Searchable variable picker modal
  labelParser.js              # Parses variable labels and metadata
  dataParser.js               # Parses the data matrix
  crosstab.js                 # Crosstabulation and chi-square engine
  societyLookup.js            # Society metadata lookup
  convert_sccs.py             # Converts DPlace CSV → compact web format
  index.html                  # Modular version (requires HTTP server)
  standalone.html             # Self-contained version (works offline)
  styles.css                  # Application styling
  resources/
    SCCS.data                 # Data matrix (186 × ~1800, space-separated)
    SCCS.lbl                  # Variable names and value labels
    SCCS.glbl                 # Society metadata (tab-separated)
    SCCS.varinfo              # Variable metadata (category, citation, etc.)

SCCS_Explorer/                # Original EthnoAtlas-based tool (86 variables)
```

## Data Pipeline

The `convert_sccs.py` script converts the DPlace long-format CSVs into compact files for the web tool:

```
dplace-data/datasets/SCCS/    →    DPlace/resources/
  variables.csv                      SCCS.data
  codes.csv                          SCCS.lbl
  data.csv                           SCCS.glbl
  societies.csv                      SCCS.varinfo
```

## Technology

- Pure JavaScript (ES6 modules)
- CSS3 with custom properties
- Client-side only — no backend required
- Responsive design

## Data Sources

**Standard Cross-Cultural Sample:**
Murdock, G. P. and White, D. R. (1969). Standard cross-cultural sample. *Ethnology*, 8(4), 329–369.

**DPlace dataset:**
Kirby, K. R., Gray, R. D., Greenhill, S. J., Jordan, F. M., Gomes-Ng, S., Bibiko, H.-J., Blasi, D. E., Botero, C. A., Bowern, C., Ember, C. R., Leehr, D., Low, B. S., McCarter, J., Divale, W., and Gavin, M. C. (2016). D-PLACE: A Global Database of Cultural, Linguistic and Environmental Diversity. *PLoS ONE*, 11(7): e0158391. doi:10.1371/journal.pone.0158391.

## License

Educational and research use.

## Author

Mike Fischer
