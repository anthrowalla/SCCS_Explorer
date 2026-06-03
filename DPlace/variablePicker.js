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
        this.history = [];             // Array of previously selected varNums (unique)
        this.renderStartIdx = 0;       // Track current render range
        this.renderEndIdx = 0;
        this.hoverTimer = null;        // Timer for hover-to-scroll
        this.hoverDelayMs = 300;       // Delay before scroll triggers (ms)

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
        this.searchInput.value = '';
        this.clearCategoryFilter();
        this.filterVariables();

        // Check if there's already a selected variable for this slot
        const inputId = slot === 'row' ? 'row-var' : 'col-var';
        const input = document.getElementById(inputId);
        let targetIndex = null;

        if (input && input.dataset.varNum) {
            const currentVarNum = parseInt(input.dataset.varNum);
            const index = this.filteredVars.findIndex(v => v.number === currentVarNum);
            if (index !== -1) {
                this.highlightedIndex = index;
                targetIndex = index;
            } else {
                this.highlightedIndex = -1;
            }
        } else {
            this.highlightedIndex = -1;
        }

        // Render with target visible if set
        this.renderResults(targetIndex);
        this.updateHighlight();

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
                <div class="picker-filter-row">
                    <div class="picker-categories"></div>
                    <div class="picker-history-wrapper">
                        <label for="picker-history" class="picker-history-label">History:</label>
                        <select id="picker-history" class="picker-history" disabled>
                            <option value="">No history</option>
                        </select>
                    </div>
                </div>
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
        this.historySelect = modal.querySelector('.picker-history');
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

        // History dropdown
        this.historySelect.addEventListener('change', () => {
            const varNum = parseInt(this.historySelect.value);
            if (varNum) {
                this.selectFromHistory(varNum);
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

    renderResults(targetIndex = null) {
        this.countDisplay.textContent = `${this.filteredVars.length} variables`;

        if (this.filteredVars.length === 0) {
            this.resultsContainer.innerHTML = '<div class="picker-empty">No matching variables</div>';
            this.previewPane.innerHTML = '<p class="picker-preview-empty">No results</p>';
            return;
        }

        let startIdx, endIdx;
        const maxShow = 100;

        if (targetIndex !== null) {
            // Render a window that includes the target index
            // Show target within first 5 items (or as close as possible)
            startIdx = Math.max(0, targetIndex - 4);
            endIdx = Math.min(this.filteredVars.length, startIdx + maxShow);
            // If we're near the end, adjust start to show maxShow items
            if (endIdx - startIdx < maxShow && this.filteredVars.length > maxShow) {
                startIdx = Math.max(0, endIdx - maxShow);
            }
        } else {
            // Default: show first 100
            startIdx = 0;
            endIdx = Math.min(this.filteredVars.length, maxShow);
        }

        let html = '';
        // Top "more" indicator with scroll-up on hover
        if (startIdx > 0) {
            html += `<div class="picker-more picker-more-top" data-earlier="${startIdx}">... ${startIdx} earlier variables (hover to scroll)</div>`;
        }
        for (let i = startIdx; i < endIdx; i++) {
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
        if (endIdx < this.filteredVars.length) {
            html += `<div class="picker-more picker-more-bottom">... and ${this.filteredVars.length - endIdx} more (hover to scroll)</div>`;
        }
        this.resultsContainer.innerHTML = html;

        // Store current render range
        this.renderStartIdx = startIdx;
        this.renderEndIdx = endIdx;

        // Attach hover event to top "more" indicator for scroll-up
        const topMore = this.resultsContainer.querySelector('.picker-more-top');
        if (topMore) {
            topMore.addEventListener('mouseenter', () => {
                this.hoverTimer = setTimeout(() => {
                    this.scrollUpOne();
                }, this.hoverDelayMs);
            });
            topMore.addEventListener('mouseleave', () => {
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    this.hoverTimer = null;
                }
            });
        }

        // Attach hover event to bottom "more" indicator for scroll-down
        const bottomMore = this.resultsContainer.querySelector('.picker-more-bottom');
        if (bottomMore) {
            bottomMore.addEventListener('mouseenter', () => {
                this.hoverTimer = setTimeout(() => {
                    this.scrollDownOne();
                }, this.hoverDelayMs);
            });
            bottomMore.addEventListener('mouseleave', () => {
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    this.hoverTimer = null;
                }
            });
        }

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
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredVars.length) {
            // Find the item with matching data-index
            const item = this.resultsContainer.querySelector(`.picker-item[data-index="${this.highlightedIndex}"]`);
            if (item) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
                this.showPreview(this.filteredVars[this.highlightedIndex]);
            }
        }
    }

    pickVariable(v) {
        if (this.currentSlot && this.onSelect) {
            this.onSelect(this.currentSlot, v.number);
            this.addToHistory(v.number);
        }
        this.close();
    }

    /**
     * Add a variable to history (if not already present)
     */
    addToHistory(varNum) {
        // Remove if already exists (will be re-added at the front)
        const existingIndex = this.history.indexOf(varNum);
        if (existingIndex !== -1) {
            this.history.splice(existingIndex, 1);
        }
        // Add to front (most recent first)
        this.history.unshift(varNum);
        this.updateHistoryDropdown();
    }

    /**
     * Update the history dropdown with current history array
     */
    updateHistoryDropdown() {
        if (!this.historySelect) return;

        if (this.history.length === 0) {
            this.historySelect.innerHTML = '<option value="">No history</option>';
            this.historySelect.disabled = true;
            return;
        }

        this.historySelect.disabled = false;
        let html = '<option value="">Select from history...</option>';
        for (const varNum of this.history) {
            const label = this.labelParser.getVariableLabel(varNum);
            const sccsNum = this.labelParser.getSccsNum(varNum);
            html += `<option value="${varNum}">${sccsNum}. ${label}</option>`;
        }
        this.historySelect.innerHTML = html;
    }

    /**
     * Select a variable from history
     * Finds it in the filtered list, highlights it, and shows preview
     */
    selectFromHistory(varNum) {
        // Clear any filters to show all variables
        this.searchTerm = '';
        this.searchInput.value = '';
        this.activeCategory = null;
        this.clearCategoryFilter();
        this.filterVariables();

        // Find the variable in the filtered list
        const index = this.filteredVars.findIndex(v => v.number === varNum);
        if (index !== -1) {
            this.highlightedIndex = index;
            // Render with target variable visible
            this.renderResults(index);
            this.updateHighlight();
            // Show preview
            this.showPreview(this.filteredVars[index]);
        }
    }

    /**
     * Scroll up by one item - add the previous variable to the top of the visible list
     */
    scrollUpOne() {
        if (this.renderStartIdx <= 0) return;

        // Move start back by 1, add one more to end to maintain window size
        const newStartIdx = this.renderStartIdx - 1;
        const maxShow = 100;
        const newEndIdx = Math.min(this.filteredVars.length, newStartIdx + maxShow);

        // Re-render with new range
        this.renderRange(newStartIdx, newEndIdx);
    }

    /**
     * Scroll down by one item - add the next variable to the bottom of the visible list
     */
    scrollDownOne() {
        // Can't scroll down if we're at the end
        if (this.renderEndIdx >= this.filteredVars.length) return;

        // Move end forward by 1, add one more to start to maintain window size
        const newEndIdx = this.renderEndIdx + 1;
        const maxShow = 100;
        let newStartIdx = newEndIdx - maxShow;
        if (newStartIdx < 0) newStartIdx = 0;

        // Re-render with new range
        this.renderRange(newStartIdx, newEndIdx);
    }

    /**
     * Render a specific range of variables (for scroll-up functionality)
     */
    renderRange(startIdx, endIdx) {
        let html = '';
        // Top "more" indicator
        if (startIdx > 0) {
            html += `<div class="picker-more picker-more-top" data-earlier="${startIdx}">... ${startIdx} earlier variables (hover to scroll)</div>`;
        }
        for (let i = startIdx; i < endIdx; i++) {
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
        if (endIdx < this.filteredVars.length) {
            html += `<div class="picker-more picker-more-bottom">... and ${this.filteredVars.length - endIdx} more (hover to scroll)</div>`;
        }
        this.resultsContainer.innerHTML = html;

        // Store current render range
        this.renderStartIdx = startIdx;
        this.renderEndIdx = endIdx;

        // Re-attach hover event to top "more" indicator
        const topMore = this.resultsContainer.querySelector('.picker-more-top');
        if (topMore) {
            topMore.addEventListener('mouseenter', () => {
                this.hoverTimer = setTimeout(() => {
                    this.scrollUpOne();
                }, this.hoverDelayMs);
            });
            topMore.addEventListener('mouseleave', () => {
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    this.hoverTimer = null;
                }
            });
        }

        // Re-attach hover event to bottom "more" indicator
        const bottomMore = this.resultsContainer.querySelector('.picker-more-bottom');
        if (bottomMore) {
            bottomMore.addEventListener('mouseenter', () => {
                this.hoverTimer = setTimeout(() => {
                    this.scrollDownOne();
                }, this.hoverDelayMs);
            });
            bottomMore.addEventListener('mouseleave', () => {
                if (this.hoverTimer) {
                    clearTimeout(this.hoverTimer);
                    this.hoverTimer = null;
                }
            });
        }

        // Re-attach events to items
        const items = this.resultsContainer.querySelectorAll('.picker-item');
        items.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const idx = parseInt(item.dataset.index);
                this.showPreview(this.filteredVars[idx]);
            });
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                this.pickVariable(this.filteredVars[idx]);
            });
        });

        // Don't restore highlight during scroll navigation - only on initial open
    }
}
