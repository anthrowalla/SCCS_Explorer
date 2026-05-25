# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based crosstabulation tool for the Standard Cross-Cultural Sample (SCCS), derived from the Ethnographic Atlas. It allows researchers to cross-tabulate variables across 186 societies with 86 available variables, including chi-square statistical analysis.

## Running the Application

The project has two deployment modes:

### Modular Version (development)
Requires an HTTP server due to ES6 module loading:
```bash
cd SCCS_Explorer
python3 -m http.server 8000
# Or use the provided script:
./start-server.sh
```
Then open http://localhost:8000

### Standalone Version
Can be opened directly in a browser without a server:
```bash
open SCCS_Explorer/standalone.html
```

## Architecture

The application uses ES6 modules with clear separation of concerns:

### Core Modules (SCCS_Explorer/*.js)

- **app.js** - Main application controller, orchestrates all components and handles UI events
- **dataParser.js** - Parses EthnoAtlas.data (space-separated values with missing data as '.')
- **labelParser.js** - Parses EthnoAtlas.lbl (AWK heredoc format with variable names and value labels)
- **societyLookup.js** - Parses EthnoAtlas.glbl (tab-separated society metadata)
- **crosstab.js** - Statistical engine for crosstabulation and chi-square calculations

### Source Data (dplace-data/datasets/SCCS/)

The DPlace project provides the full SCCS dataset in long-format CSV (26MB, 329K rows). These files are the source for conversion to the compact web format via `DPlace/convert_sccs.py`:

- **data.csv** - Coded values (soc_id, var_id, code) — one row per society-variable observation
- **variables.csv** - Variable metadata (id, category, title, definition, type)
- **codes.csv** - Value code descriptions (var_id, code, description, name)
- **societies.csv** - Society metadata (id, pref_name, focal_year, Lat, Long)

These files will be needed as the project progresses (e.g. for enhanced variable browsing, data updates, or generating subsets).

### Data Files (SCCS_Explorer/resources/)

- **EthnoAtlas.data** - Raw data matrix (186 cases × 86 variables)
- **EthnoAtlas.lbl** - Variable definitions and value labels in AWK script format
- **EthnoAtlas.glbl** - Society names, years, areas, classifications (tab-separated)
- **EthnoAtlas.cases** - Detailed society information (optional)
- **SCCS.data** - SCCS data matrix (hard-linked from DPlace/resources)
- **SCCS.glbl** - SCCS society metadata (hard-linked from DPlace/resources)
- **SCCS.lbl** - SCCS variable definitions and value labels (hard-linked from DPlace/resources)

**Note:** The SCCS.* data files in SCCS_Explorer/resources are hard-linked to their counterparts in DPlace/resources. Editing one will modify the other.

### Key Architectural Patterns

1. **Variable numbering is 1-indexed** - The original data format uses 1-based indexing for variables. DataParser converts to 0-indexed internally but other modules expect 1-indexed variable numbers.

2. **Missing data representation** - Missing values are stored as `null` in parsed data, represented as '.' in the data file.

3. **Cell tracking** - The crosstab engine tracks which cases belong to each cell via `cellCases` mapping, enabling click-to-view-societies functionality.

4. **Dual deployment** - The modular version loads data files via fetch(); the standalone version embeds all data inline.

5. **ES6 modules** - All modules use export default and are imported without extensions in app.js.

### Data File Formats

**EthnoAtlas.data**: Space-separated values
```
1 2 3 . 5
2 3 1 4 5
```

**EthnoAtlas.lbl**: AWK heredoc format
```
1. Variable Name
  1 Value One
  2 Value Two
  . Missing
```

**EthnoAtlas.glbl**: Tab-separated
```
ID	SocietyName	Year	Area	Classification
```

## UI Components

The main UI panels (all with `.panel` class):
- `#selection-panel` - Variable selection form
- `#results-panel` - Crosstab table and statistics
- `#browse-panel` - Variable browser
- `#cellModal` - Modal for showing societies in a cell

The modal uses `.active` class to show/hide (not `.hidden` like panels).
