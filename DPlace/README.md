# DPlace SCCS Crosstabulation Tool

A web-based tool for cross-tabulating variables from the DPlace Standard Cross-Cultural Sample (SCCS) dataset.

## About This Branch

This is the `dplace` branch - an extension of the original SCCS Explorer to support the full DPlace SCCS dataset with **over 1,968 variables** for 186 societies.

## Features

- **Variable Search**: Search through 1,968+ variables by name, category, or description
- **Crosstabulation**: Generate crosstab tables with 186 societies
- **Statistical Analysis**: Chi-square test of independence
- **Color Coding**: Visual representation of cell frequencies
- **Cell Details**: Click any cell to see society information
- **Modal Interface**: Centered popup with detailed society listings
- **Dual Interface**: Both modular and standalone versions available

## Data

- **186 societies** from the DPlace SCCS dataset
- **1,968 variables** covering various aspects of human societies
- **Rich metadata**: Categories, definitions, sources for each variable
- **Detailed society information** including geographic location and external references

## Usage

### Modular Version (Requires HTTP Server)
```bash
cd DPlace
python3 -m http.server 8000
# Or use: ./start-server.sh
```

Then open: http://localhost:8000/index.html

### Standalone Version (Works Offline)
```bash
open DPlace/standalone.html
```

## Files

- `index.html` - Modular version (requires HTTP server)
- `standalone.html` - Self-contained version (works offline)
- `app.js` - Main application logic
- `sccsDataParser.js` - DPlace SCCS data parser (CSV long format)
- `sccsLabelParser.js` - DPlace SCCS label parser (with search)
- `crosstab.js` - Statistical calculations
- `societyLookup.js` - Society information handler
- `styles.css` - Application styling
- `resources/` - Data files (variables.csv, codes.csv, data.csv, societies.csv)

## Technology

- Pure JavaScript (ES6 modules)
- CSS3 with custom properties
- Client-side only (no backend required)
- Responsive design

## Data Sources

Data files from:
- **DPlace SCCS dataset** (`../dplace-data/datasets/SCCS/`)
  - `variables.csv` - Variable definitions and metadata
  - `codes.csv` - Value code descriptions
  - `data.csv` - Raw data in long format
  - `societies.csv` - Society information with geographic data

## Development Status

This is a work in progress. The original EA-based tool (86 variables) is in the `main` branch under `SCCS_Explorer/`.

## License

Educational and research use.

## Authors

Mike Fischer

## Version

2.0.0 - DPlace SCCS integration (in development)
