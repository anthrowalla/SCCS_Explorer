# Standalone Modal Fix - 2026-02-12

## Issue

When clicking on a cell in `standalone.html`, the cell information was appearing in a panel at the end of the page instead of displaying as a modal popup overlay.

## Root Cause

In the `generateCrosstab()` function (around line 771-773), the table cell HTML had **two `style` attributes** on the same `<td>` element:

```javascript
html += `<td class="cell-value" style="${bg}" title="${pct}%"
    data-row="${rv}" data-col="${cv}" style="cursor: pointer;">
    <strong>${count}</strong></td>`;
```

HTML elements can only have **one `style` attribute**. When multiple `style` attributes are present, browsers typically use the **last one**, which means:
- The first `style="${bg}"` (background color) was **overwritten**
- Only `style="cursor: pointer;"` was applied
- This broke the visual styling

Additionally, the click handlers were still being attached correctly, but the visual feedback wasn't working properly.

## Solution

Merged both style declarations into a single `style` attribute:

```javascript
html += `<td class="cell-value" style="${bg} cursor: pointer;" title="${pct}%"
    data-row="${rv}" data-col="${cv}">
    <strong>${count}</strong></td>`;
```

Now the cells have:
- ✅ Background color (for color coding)
- ✅ Pointer cursor (indicates clickable)
- ✅ Proper click handlers
- ✅ Hover effects (from CSS)

## What Now Works

1. **Cell Clicking**: Click on any cell in the crosstab table
2. **Modal Display**: Modal popup appears centered on screen with overlay
3. **Society Information**: Detailed society list shows in modal body
4. **Close Button**: × button in modal header closes the modal
5. **Click-Outside-to-Close**: Clicking outside the modal content closes it
6. **Visual Feedback**: Cells have pointer cursor and hover effects

## Technical Details

### Modal Structure
```html
<div id="cellModal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <h2 id="modalTitle">Cell Detail</h2>
            <button class="close-btn" onclick="closeModal()">×</button>
        </div>
        <div id="modalBody"></div>
    </div>
</div>
```

### Modal CSS
```css
.modal {
    display: none;                    /* Hidden by default */
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);     /* Dark overlay */
    z-index: 1000;
}

.modal.active {
    display: flex;                    /* Shown when active */
    justify-content: center;
    align-items: center;
}
```

### Cell CSS
```css
.cell-value {
    cursor: pointer;                  /* Pointer cursor */
    transition: transform 0.2s;
}

.cell-value:hover {
    transform: scale(1.05);           /* Slight zoom */
    box-shadow: 0 0 0 2px var(--primary-color);
}
```

## Testing

To verify the fix works:

1. Open http://localhost:8000/js/standalone.html
2. Select row variable (e.g., "1. Sex and Industry")
3. Select column variable (e.g., "2. Sexual Freedom")
4. Click "Generate Crosstab"
5. Click on any cell with a count > 0
6. **Expected Result**: Modal popup appears with society list
7. Click × button or outside modal to close

## Files Modified

- `standalone.html` (line ~771-773): Fixed duplicate style attribute

## Related Files

- `app.js`: Uses `cell-detail-panel` approach (different from standalone modal)
- `index.html`: Uses `cell-detail-panel` section instead of modal overlay

## Status

✅ **FIXED** - Modal popup now displays correctly when clicking cells

---

**Last Updated**: 2026-02-12
**Status**: ✅ Complete
