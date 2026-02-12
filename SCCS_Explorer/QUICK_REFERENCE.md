# EthnoAtlas Application - Quick Reference

## Quick Start

### Start the Server
```bash
cd /Users/mike/Dropbox/HRAF/2026/Ethnoatlas/EthnoAtlas/NewerCross/js
python3 -m http.server 8000
```

### Open the Application
- **Modular Version**: http://localhost:8000/js/index.html
- **Standalone Version**: http://localhost:8000/js/standalone.html (or double-click the file)

## Common Commands

### Stop the Server
```bash
lsof -ti:8000 | xargs kill -9
```

### Restart the Server
```bash
lsof -ti:8000 | xargs kill -9 2>/dev/null; python3 -m http.server 8000 > /dev/null 2>&1 &
```

## Application URLs

| Version | URL | Protocol |
|---------|-----|----------|
| Modular (index.html) | http://localhost:8000/js/index.html | HTTP |
| Standalone (standalone.html) | http://localhost:8000/js/standalone.html | HTTP or file:// |

## Features Checklist

- ✅ Automatic data loading
- ✅ Variable selection (86 variables)
- ✅ Crosstabulation (186 societies)
- ✅ Cell interactivity (click for details)
- ✅ Society information display
- ✅ Statistical analysis (chi-square)
- ✅ Color coding
- ✅ Close button functionality
- ✅ New search functionality

## File Locations

| File | Location |
|------|----------|
| index.html | js/index.html |
| standalone.html | js/standalone.html |
| app.js | js/app.js |
| Data files | js/resources/ |

## What Just Got Fixed (2026-02-12)

1. ✅ **Fixed closeModal() method** - Moved to proper class method
2. ✅ **Fixed element references** - Updated to use correct panel IDs
3. ✅ **Fixed new search button** - Now properly hides detail panel
4. ✅ **Removed invalid syntax** - No more nested function definitions

## Testing the Application

1. Open http://localhost:8000/js/index.html
2. Select row variable (e.g., "1. Sex and Industry")
3. Select column variable (e.g., "2. Sexual Freedom")
4. Click "Generate Crosstab"
5. Click on any cell to see society details
6. Click "Close" button to hide details
7. Click "New Search" to start over

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Server not starting | Check if port 8000 is in use: `lsof -ti:8000` |
| Files not loading | Check resources/ folder exists with data files |
| Modal not closing | Check browser console for errors |
| Cells not clickable | Check if crosstab has been generated |

## Documentation Files

| File | Purpose |
|------|---------|
| README.md | Main documentation |
| QUICKSTART.md | Quick start guide |
| SETUP_COMPLETE.md | Setup notes |
| MODAL_FIXES.md | Recent fix details |
| FINAL_STATUS.md | Complete status report |
| progress.md | Implementation progress |

---

**Status**: ✅ **ALL SYSTEMS OPERATIONAL**

**Last Updated**: 2026-02-12
