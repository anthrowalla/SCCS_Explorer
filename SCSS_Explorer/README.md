# EthnoAtlas Crosstabulation - Modern JavaScript Version

A modern web-based implementation of the 1990s shellscript/CGI-BIN crosstabulation system for analyzing ethnographic data from the Ethnographic Atlas.

## Three Ways to Run the Application

### Option 1: Standalone Version (Easiest - No Server Required)

**File:** `standalone.html`

This version allows you to manually load the data files through the browser. No web server needed!

1. Open `standalone.html` in your browser (double-click it)
2. Click "Choose Files" to select:
   - `EthnoAtlas.data`
   - `EthnoAtlas.lbl`
   - `EthnoAtlas.glbl`
3. Click "Load and Start Application"
4. Generate crosstabs!

**Pros:** Works offline, no setup required
**Cons:** Need to select files each time (or use browser's "Remember decision")

### Option 2: HTTP Server (Recommended)

Start a local web server from the `js/` directory:

```bash
cd js/
./start-server.sh
# or manually:
python3 -m http.server 8000
# or
npx http-server -p 8000
```

Then open: http://localhost:8000

**Pros:** Fast reload, automatic data loading
**Cons:** Requires starting a server

### Option 3: Pre-generated JSON Data

For the fastest startup, generate a single JSON file first:

```bash
cd js/
node dataLoader.js
```

Then use `standalone.html` and select the generated `ethnoAtlasData.json` file.

**Pros:** Fastest loading after initial setup
**Cons:** One-time setup required

## Features Implemented

### Core Functionality
- **Variable Selection**: Choose two variables from the dataset to cross-tabulate
- **Crosstabulation Tables**: Displays frequency counts for each cell intersection
- **Statistical Analysis**:
  - Observed counts
  - Expected values (based on independence assumption)
  - Observed - Expected (O-E) deviations
  - Chi-square contribution per cell
  - Overall chi-square test with significance testing
- **Color Coding**: Cells shaded by frequency (white to dark red gradient)

### Interactive Features
- **Cell Drill-Down**: Click on any cell to see the list of societies in that intersection
- **Browse Variables**: Browse all available variables with their value labels
- **Variable Information**: See variable descriptions when making selections
- **Merge Categories**: Framework for merging row/column categories (checkbox enabled)

## File Structure

```
js/
├── index.html          # Main HTML page
├── styles.css          # Styling
├── app.js              # Main application controller
├── dataParser.js       # Parses EthnoAtlas.data (fixed-width format)
├── labelParser.js      # Parses .lbl script format for labels
├── crosstab.js         # Crosstabulation engine (crossx equivalent)
└── societyLookup.js    # Parses .glbl for society names

# Data files (in parent directory)
../EthnoAtlas.data      # Raw data: 186 societies × 86 variables
../EthnoAtlas.lbl       # Variable and value label definitions
../EthnoAtlas.glbl      # Society names and metadata
```

## How to Use

### Option 1: Simple HTTP Server (Python)

From the `js/` directory:

```bash
python3 -m http.server 8000
```

Then open: `http://localhost:8000`

### Option 2: Node.js http-server

```bash
npx http-server -p 8000
```

### Option 3: VS Code Live Server

1. Install "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"

## Data Format

### EthnoAtlas.data
Fixed-width space-separated values:
- Each row = one society
- Each column = one variable
- Missing data = `.` (period)
- 186 societies (cases)
- 86 variables

### EthnoAtlas.lbl
AWK script format with embedded heredoc:
```
1.  VARIABLE NAME
    1  Value label 1
    2  Value label 2
```

### EthnoAtlas.glbl
Tab-separated society lookup:
```
ID	Name	Year	Area	Code1	Code2	Notes
```

## Comparison to Original System

| Original Shell/CGI | Modern JavaScript |
|-------------------|-------------------|
| `atabs` (CGI script) | `app.js` (ES6 module) |
| `crossx` (C program) | `crosstab.js` (CrosstabEngine class) |
| AWK label scripts | `labelParser.js` |
| Server-side processing | Client-side browser processing |
| uncgi variable parsing | HTML form handling |
| Static HTML generation | Dynamic DOM manipulation |

## Key Improvements

1. **No Server Required**: Runs entirely in the browser
2. **Modern UI**: Responsive design with clean CSS
3. **Faster Interaction**: No round-trips to server
4. **Better Error Handling**: Graceful failure messages
5. **Extensible**: Easy to add new features

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES6 module support
- Works offline after initial load

## Future Enhancements

Possible additions not yet implemented:

1. **Category Merging UI**: Add dropdown menus next to rows/columns to merge categories
2. **Export Functions**: Export tables as CSV or image
3. **Filtering**: Filter societies by criteria before crosstabulation
4. **Multiple Datasets**: Support for different Ethnographic Atlas datasets
5. **Visualization**: Add bar charts or mosaic plots
6. **Yates Correction**: For chi-square with small expected values
7. **Fisher's Exact Test**: For 2x2 tables with small counts

## Credits

Based on the original EthnoAtlas crosstabulation system from the mid-1990s.
Recreated as a modern JavaScript web application in 2025.
