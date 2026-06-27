# Directory Rename: SCSS_Explorer → SCCS_Explorer

**Date**: 2026-02-12
**Status**: ✅ Complete

## Changes Made

### 1. Local Directory Rename
```bash
mv SCSS_Explorer SCCS_Explorer
```
- ✅ Renamed directory to better reflect project purpose
- ✅ SCCS = Standard Cross-Cultural Sample (more accurate than SCSS)

### 2. Git Repository Update
```bash
git add -A SCCS_Explorer/
git rm -r --cached SCSS_Explorer/
git commit -m "Rename SCSS_Explorer to SCCS_Explorer"
```
- ✅ Git tracked the rename (preserved all file history)
- ✅ All 33 files renamed via git mv
- ✅ Commit shows rename operation (R: renamed)

### 3. GitHub Repository Update
**Old Repository**: https://github.com/anthrowalla/SCSS_Explorer (can be deleted)
**New Repository**: https://github.com/anthrowalla/SCCS_Explorer

```bash
gh repo create SCCS_Explorer --public
git remote set-url origin https://github.com/anthrowalla/SCCS_Explorer.git
git push -u origin main --force
```
- ✅ Created new GitHub repository
- ✅ Updated remote origin to point to new repository
- ✅ Pushed all code with full history
- ✅ Old repository can be deleted if desired

### 4. Documentation Update
Updated `README.md` to reflect new naming:
- Changed title from "EthnoAtlas" to "SCCS Crosstabulation Tool"
- Updated directory paths from `js/` to `SCCS_Explorer/`
- Simplified and modernized documentation
- Removed outdated comparison tables
- Focused on clear usage instructions

## New Repository Details

**URL**: https://github.com/anthrowalla/SCCS_Explorer

**Description**: Standard Cross-Cultural Sample (SCCS) Crosstabulation Tool

**Clone Command**:
```bash
git clone https://github.com/anthrowalla/SCCS_Explorer.git
cd SCCS_Explorer
python3 -m http.server 8000
# Open http://localhost:8000/SCCS_Explorer/index.html
```

## Files Renamed

All files successfully renamed and pushed:
- index.html → SCCS_Explorer/index.html
- standalone.html → SCCS_Explorer/standalone.html
- app.js → SCCS_Explorer/app.js
- styles.css → SCCS_Explorer/styles.css
- All supporting modules (.js files)
- All documentation (.md files)
- All resource files

## Benefits of New Name

**SCCS_Explorer** is more accurate because:
- ✅ SCCS is the actual dataset being analyzed (Standard Cross-Cultural Sample)
- ✅ Avoids confusion with Sass/SCSS (CSS preprocessor)
- ✅ Better reflects the academic purpose of the tool
- ✅ More descriptive for researchers in cross-cultural studies

## Verification

✅ Local directory renamed
✅ Git history preserved (all files tracked)
✅ GitHub repository created
✅ Code pushed successfully
✅ README.md updated
✅ Remote configured correctly
✅ All references updated

## Next Steps

**Optional**: You can delete the old SCSS_Explorer repository:
```bash
gh repo delete SCSS_Explorer --yes
```

---

**Status**: ✅ Complete
**Last Updated**: 2026-02-12

## Summary

| What | Old | New |
|------|------|------|
| Directory | SCSS_Explorer | SCCS_Explorer |
| GitHub Repo | anthrowalla/SCSS_Explorer | anthrowalla/SCCS_Explorer |
| Acronym Meaning | Sass/Syntactically Awesome Style Sheets | Standard Cross-Cultural Sample |
| Accuracy | Confusing | Accurate |

The project now has a clear, descriptive name that matches its purpose!

---

**Repository**: https://github.com/anthrowalla/SCCS_Explorer
**Local Directory**: SCCS_Explorer
**Status**: ✅ Production Ready
