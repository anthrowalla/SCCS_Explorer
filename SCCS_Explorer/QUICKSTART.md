# Quick Start Guide

## The Easiest Way (No Server!)

1. **Open `standalone.html`** in your browser
   - Just double-click the file or drag it into your browser

2. **Load the data files** by clicking the file selectors:
   - Select `../EthnoAtlas.data`
   - Select `../EthnoAtlas.lbl`
   - Select `../EthnoAtlas.glbl`
   - Click "Load and Start Application"

3. **Create a crosstabulation:**
   - Select a Row Variable (e.g., "4. GATHERING")
   - Select a Column Variable (e.g., "8. AGRICULTURE")
   - Click "Generate Crosstab"

4. **Explore the results:**
   - See how societies are distributed across the two variables
   - Cells are color-coded by frequency (darker = more societies)
   - Check "Show statistics" for chi-square analysis

## Try These Variables

| Variable | Name | Description |
|----------|------|-------------|
| 1 | REGION | Major world region |
| 4 | GATHERING | Economic activity from gathering |
| 8 | AGRICULTURE | Economic activity from agriculture |
| 9 | BETROTHAL | Marriage payment practices |
| 30 | SETTLEMENT PATTERN | Community size and mobility |
| 35 | INHERITANCE | Property inheritance rules |
| 86 | SLAVERY | Presence of slavery |

## Troubleshooting

**Problem:** "Can't find the data files"
**Solution:** Make sure you're selecting files from the parent directory (NewerCross/), not from the js/ subdirectory

**Problem:** "Files not loading"
**Solution:** Make sure you have all three files:
- EthnoAtlas.data (35K)
- EthnoAtlas.lbl (28K)
- EthnoAtlas.glbl (9K)

**Problem:** Page shows "Error Loading Data Files"
**Solution:** Use the `standalone.html` version instead - it works without a server!
