/**
 * Variable Picker Module
 * Searchable, category-filtered variable picker for ~1800 SCCS variables.
 * Builds a modal with search, category chips, scrollable results, and preview.
 */

export default class VariablePicker {
    /**
     * @param {LabelParser} labelParser - loaded label parser with varinfo
     * @param {DataParser} dataParser - loaded data parser for coverage counts
     * @param {function} onSelect - callback(slot, varNum) when user picks a variable
     */
    constructor(labelParser, dataParser, onSelect) {
        this.labelParser = labelParser;
        this.dataParser = dataParser;
        this.onSelect = onSelect;
        this.currentSlot = null;       // 'row' or 'col'
        this.activeCategory = null;    // currently filtered category
        this.searchTerm = '';
        this.highlightedIndex = -1;
        this.filteredVars = [];

        this.modal = null;
        this.built = false;
    }

    /**
     * Open the picker for a given slot ('row' or 'col')
     */
    open(slot) {
        this.currentSlot = slot;
        if (!this.built) {
            this.buildModal();
            this.built = true;
        }
        this.searchTerm = '';
        this.activeCategory = null;
        this.highlightedIndex = -1;
        this.searchInput.value = '';
        this.clearCategoryFilter();
        this.filterVariables();
        this.modal.classList.add('active');
        this.searchInput.focus();
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
    }

    /**
     * Update the display for an already-selected variable
     */
    setSelected(slot, varNum) {
        const input = document.getElementById(slot === 'row' ? 'row-var' : 'col-var');
        if (varNum && input) {
            const label = this.labelParser.getVariableLabel(varNum);
            const sccsNum = this.labelParser.getSccsNum(varNum);
            const category = this.labelParser.getCategory(varNum);
            input.value = `${sccsNum}. ${label}` + (category ? ` [${category}]` : '');
            input.dataset.varNum = varNum;
        }
    }

    buildModal() {
        const modal = document.createElement('div');
        modal.className = 'picker-modal';
        modal.innerHTML = `
            <div class="picker-content">
                <div class="picker-header">
                    <h2>Select Variable</h2>
                    <button class="picker-close-btn" type="button">&times;</button>
                </div>
                <div class="picker-search-row">
                    <input type="text" class="picker-search" placeholder="Search by number, title, or keyword..." autocomplete="off">
                    <span class="picker-count"></span>
                </div>
                <div class="picker-categories"></div>
                <div class="picker-body">
                    <div class="picker-results"></div>
                    <div class="picker-preview">
                        <p class="picker-preview-empty">Hover over a variable to see details</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.modal = modal;
        this.searchInput = modal.querySelector('.picker-search');
        this.countDisplay = modal.querySelector('.picker-count');
        this.categoriesBar = modal.querySelector('.picker-categories');
        this.resultsContainer = modal.querySelector('.picker-results');
        this.previewPane = modal.querySelector('.picker-preview');

        // Close button
        modal.querySelector('.picker-close-btn').addEventListener('click', () => this.close());

        // Click backdrop to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        // Search input
        this.searchInput.addEventListener('input', () => {
            this.searchTerm = this.searchInput.value.trim().toLowerCase();
            this.highlightedIndex = -1;
            this.filterVariables();
        });

        // Keyboard navigation
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.filteredVars.length - 1);
                this.updateHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
                this.updateHighlight();
            } else if (e.key === 'Enter' && this.highlightedIndex >= 0) {
                e.preventDefault();
                this.pickVariable(this.filteredVars[this.highlightedIndex]);
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Build category chips
        this.buildCategoryChips();
    }

    buildCategoryChips() {
        const categories = this.labelParser.getCategories();
        // "All" chip
        let html = '<button class="picker-chip active" data-category="">All</button>';
        for (const cat of categories) {
            html += `<button class="picker-chip" data-category="${cat}">${cat}</button>`;
        }
        this.categoriesBar.innerHTML = html;

        this.categoriesBar.querySelectorAll('.picker-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const cat = chip.dataset.category;
                this.activeCategory = cat || null;
                this.categoriesBar.querySelectorAll('.picker-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.highlightedIndex = -1;
                this.filterVariables();
            });
        });
    }

    clearCategoryFilter() {
        this.activeCategory = null;
        const chips = this.categoriesBar.querySelectorAll('.picker-chip');
        chips.forEach(c => c.classList.remove('active'));
        chips[0].classList.add('active');  // "All" chip
    }

    filterVariables() {
        const allVars = this.labelParser.getAllVariables();
        this.filteredVars = [];

        for (const v of allVars) {
            // Category filter
            if (this.activeCategory) {
                const cat = this.labelParser.getCategory(v.number);
                if (cat !== this.activeCategory) continue;
            }

            // Search filter
            if (this.searchTerm) {
                const numStr = String(v.number);
                const sccsStr = v.sccsNum;
                const title = v.name.toLowerCase();
                const cat = this.labelParser.getCategory(v.number).toLowerCase();
                const def = this.labelParser.getDefinition(v.number).toLowerCase();
                const term = this.searchTerm;

                if (!numStr.includes(term) && !sccsStr.includes(term) && !title.includes(term) && !cat.includes(term) && !def.includes(term)) {
                    continue;
                }
            }

            this.filteredVars.push(v);
        }

        this.renderResults();
    }

    renderResults() {
        this.countDisplay.textContent = `${this.filteredVars.length} variables`;

        if (this.filteredVars.length === 0) {
            this.resultsContainer.innerHTML = '<div class="picker-empty">No matching variables</div>';
            this.previewPane.innerHTML = '<p class="picker-preview-empty">No results</p>';
            return;
        }

        // Render visible slice for performance (show first 100)
        const showCount = Math.min(this.filteredVars.length, 100);
        let html = '';
        for (let i = 0; i < showCount; i++) {
            const v = this.filteredVars[i];
            const cat = this.labelParser.getCategory(v.number);
            const vtype = this.labelParser.getType(v.number);
            html += `<div class="picker-item" data-index="${i}" data-var="${v.number}">
                <span class="picker-item-num">${v.sccsNum}</span>
                <span class="picker-item-title">${v.name}</span>
                <span class="picker-item-cat">${cat}</span>
                <span class="picker-item-type">${vtype}</span>
            </div>`;
        }
        if (this.filteredVars.length > showCount) {
            html += `<div class="picker-more">... and ${this.filteredVars.length - showCount} more (type to narrow)</div>`;
        }
        this.resultsContainer.innerHTML = html;

        // Attach events to items
        this.resultsContainer.querySelectorAll('.picker-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                const idx = parseInt(item.dataset.index);
                this.showPreview(this.filteredVars[idx]);
            });
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                this.pickVariable(this.filteredVars[idx]);
            });
        });
    }

    showPreview(v) {
        const cat = this.labelParser.getCategory(v.number);
        const vtype = this.labelParser.getType(v.number);
        const def = this.labelParser.getDefinition(v.number);
        const citation = this.labelParser.getCitation(v.number);
        const sccsNum = this.labelParser.getSccsNum(v.number);

        let html = `<div class="picker-preview-title">${sccsNum}. ${v.name}</div>`;
        html += `<div class="picker-preview-meta">`;
        if (cat) html += `<span class="picker-preview-cat">${cat}</span>`;
        if (vtype) html += `<span class="picker-preview-type">${vtype}</span>`;
        html += `</div>`;

        // Show coverage: how many societies have a value for this variable
        const totalSocieties = this.dataParser.getCaseCount();
        const values = this.dataParser.getVariableValues(v.number);
        const nonMissing = values.filter(val => val !== null).length;
        html += `<div class="picker-preview-coverage">${nonMissing}/${totalSocieties} societies coded</div>`;

        // Show value codes
        if (this.labelParser.hasValueLabels(v.number)) {
            const labels = this.labelParser.getValueLabelsForVariable(v.number);
            html += '<div class="picker-preview-codes"><strong>Values:</strong> ';
            for (const vl of labels.slice(0, 15)) {
                html += `<span class="picker-code">${vl.code}: ${vl.label}</span> `;
            }
            if (labels.length > 15) {
                html += `<span class="picker-code-more">... +${labels.length - 15} more</span>`;
            }
            html += '</div>';
        }

        // Show citation
        if (citation) {
            html += `<div class="picker-preview-citation">${citation}</div>`;
        }

        // Show full description
        if (def) {
            html += `<div class="picker-preview-def">${def}</div>`;
        }

        this.previewPane.innerHTML = html;
    }

    updateHighlight() {
        const items = this.resultsContainer.querySelectorAll('.picker-item');
        items.forEach(item => item.classList.remove('highlighted'));
        if (this.highlightedIndex >= 0 && this.highlightedIndex < items.length) {
            const item = items[this.highlightedIndex];
            item.classList.add('highlighted');
            item.scrollIntoView({ block: 'nearest' });
            this.showPreview(this.filteredVars[this.highlightedIndex]);
        }
    }

    pickVariable(v) {
        if (this.currentSlot && this.onSelect) {
            this.onSelect(this.currentSlot, v.number);
        }
        this.close();
    }
}
