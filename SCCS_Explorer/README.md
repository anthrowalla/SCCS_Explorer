# Standard Cross-Cultural Sample (SCCS) Crosstabulation Tool

A web-based tool for cross-tabulating variables from the Standard Cross-Cultural Sample, derived from the Ethnographic Atlas.

## Features

- **Variable Selection**: Choose row and column variables from 86 available variables
- **Crosstabulation**: Generate crosstab tables with 186 societies
- **Statistical Analysis**: Chi-square test of independence
- **Color Coding**: Visual representation of cell frequencies
- **Cell Details**: Click any cell to see society information
- **Modal Interface**: Centered popup with detailed society listings
- **Dual Interface**: Both modular and standalone versions available

## Data

- **186 societies** from Standard Cross-Cultural Sample
- **86 variables** covering various aspects of human societies
- **Detailed information** for each society including year, area, and classification

## Usage

### Modular Version (Requires HTTP Server)
```bash
cd SCCS_Explorer
python3 -m http.server 8000
```

Then open: http://localhost:8000/SCCS_Explorer/index.html

### Standalone Version (Works Offline)
```bash
open SCCS_Explorer/standalone.html
```

## Files

- `index.html` - Modular version (requires HTTP server)
- `standalone.html` - Self-contained version (works offline)
- `app.js` - Main application logic
- `styles.css` - Application styling
- `crosstab.js` - Statistical calculations
- `labelParser.js` - Label parsing
- `dataParser.js` - Data file parsing
- `societyLookup.js` - Society information handler
- `dataLoader.js` - JSON conversion utility
- `resources/` - Data files (EthnoAtlas.data, .lbl, .glbl, .cases)

## Technology

- Pure JavaScript (ES6 modules)
- CSS3 with custom properties
- Client-side only (no backend required)
- Responsive design

## Data Sources

Data files derived from:
- Ethnographic Atlas
- Standard Cross-Cultural Sample (SCCS)

## License

Educational and research use.

## Authors

Mike Fischer

## Version

1.0.0 - Initial release
