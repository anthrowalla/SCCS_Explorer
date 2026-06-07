/**
 * Main Application Module
 * Coordinates all components and handles UI interactions
 */

import DataParser from './dataParser.js';
import LabelParser from './labelParser.js';
import CrosstabEngine from './crosstab.js';
import OwcLookup from './owcLookup.js';
import VariablePicker from './variablePicker.js';

class EthnoAtlasApp {
    constructor() {
        this.dataParser = new DataParser();
        this.labelParser = new LabelParser();
        this.owlLookup = new OwcLookup();
        this.crosstabEngine = null;
        this.currentCrosstab = null;
        this.currentStats = null;
        this.mergeEnabled = false;
        this.rowMergeMap = {};
        this.colMergeMap = {};
        this.picker = null;

        // Selected variable state
        this.selectedRowVar = null;
        this.selectedColVar = null;

        // Configuration - paths relative to the HTML file
        this.config = {
            dataFile: 'resources/SCCS.data',
            labelFile: 'resources/SCCS.lbl',
            owcInfoFile: 'resources/owc_info.json',
            varInfoFile: 'resources/SCCS.varinfo'
        };

        this.init();
    }

    async init() {
        console.log('Initializing EthnoAtlas Crosstabulation Application...');
        console.log('Current page URL:', window.location.href);

        // Show loading message
        this.showLoading('Loading data files...');

        try {
            console.log('Attempting to load files from:');
            console.log('  ', this.config.dataFile);
            console.log('  ', this.config.labelFile);
            console.log('  ', this.config.owcInfoFile);
            console.log('  ', this.config.varInfoFile);

            // Load all data
            const [dataResult, labelsResult, owcResult, varInfoResult] = await Promise.allSettled([
                this.dataParser.loadData(this.config.dataFile),
                this.labelParser.loadLabels(this.config.labelFile),
                this.owlLookup.loadOwcInfo(this.config.owcInfoFile),
                this.labelParser.loadVarInfo(this.config.varInfoFile)
            ]);

            // Check for errors
            const errors = [];
            if (dataResult.status === 'rejected') errors.push(`Data file: ${dataResult.reason.message}`);
            if (labelsResult.status === 'rejected') errors.push(`Label file: ${labelsResult.reason.message}`);
            if (owcResult.status === 'rejected') errors.push(`OWC info file: ${owcResult.reason.message}`);
            if (varInfoResult.status === 'rejected') errors.push(`VarInfo file: ${varInfoResult.reason.message}`);

            if (errors.length > 0) {
                throw new Error('Failed to load data files:\n' + errors.join('\n'));
            }

            // Initialize crosstab engine
            this.crosstabEngine = new CrosstabEngine(this.dataParser, this.labelParser);

            // Initialize variable picker
            this.picker = new VariablePicker(this.labelParser, this.dataParser, (slot, varNum) => {
                this.onVariableSelected(slot, varNum);
            });

            // Set up event listeners
            this.setupEventListeners();

            this.hideLoading();
            console.log('Initialization complete!');
            console.log(`Loaded ${this.dataParser.getCaseCount()} societies with ${this.dataParser.getVariableCount()} variables`);
            console.log(`Categories: ${this.labelParser.getCategories().join(', ')}`);

        } catch (error) {
            this.hideLoading();
            console.error('Error during initialization:', error);
            this.showErrorDetailed(error);
        }
    }

    onVariableSelected(slot, varNum) {
        if (slot === 'row') {
            this.selectedRowVar = varNum;
        } else {
            this.selectedColVar = varNum;
        }
        this.picker.setSelected(slot, varNum);
        this.updateVariableInfo();
    }

    showLoading(message) {
        const container = document.querySelector('.container');
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.style.cssText = 'text-align: center; padding: 40px; font-size: 1.2rem;';
        loadingDiv.innerHTML = `<div class="loading"></div><p style="margin-top: 20px;">${message}</p>`;
        container.insertBefore(loadingDiv, container.firstChild);
    }

    hideLoading() {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.remove();
    }

    showErrorDetailed(error) {
        const errorMessage = error.message || 'Unknown error';
        const container = document.querySelector('main');

        container.innerHTML = `
            <div class="panel" style="background-color: #fee; border: 2px solid #c00;">
                <h2 style="color: #c00;">Error Loading Data Files</h2>
                <p><strong>The application could not load the required data files.</strong></p>
                <p style="font-family: monospace; background: #fff; padding: 10px; margin: 10px 0;">${errorMessage}</p>

                <h3>Possible Solutions:</h3>
                <ol>
                    <li><strong>Use a local web server</strong> - Browsers block file:// access for security.
                        <ul>
                            <li>From the DPlace/ directory, run: <code>python3 -m http.server 8000</code>
                            <li>Then open: http://localhost:8000</li>
                        </ul>
                    </li>
                    <li><strong>Check file locations</strong> - The data files should be in resources/:
                        <ul>
                            <li>resources/SCCS.data</li>
                            <li>resources/SCCS.lbl</li>
                            <li>resources/SCCS.glbl</li>
                            <li>resources/SCCS.varinfo</li>
                        </ul>
                    </li>
                </ol>
                <p><button onclick="location.reload()" class="btn-primary">Retry</button></p>
            </div>
        `;
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('crosstab-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateCrosstab();
        });

        // Variable picker inputs — open picker on click
        document.querySelectorAll('.var-picker-input').forEach(input => {
            input.addEventListener('click', () => {
                const slot = input.dataset.slot;
                this.picker.open(slot);
            });
            input.addEventListener('focus', () => {
                input.blur(); // prevent keyboard on mobile; we want the picker
                const slot = input.dataset.slot;
                this.picker.open(slot);
            });
        });

        // New search button
        document.getElementById('btn-new-search').addEventListener('click', () => {
            this.showPanel('selection-panel');
            document.getElementById('results-panel').classList.add('hidden');
            document.getElementById('cellModal').classList.remove('active');
        });

        // Close modal button
        document.getElementById('btn-close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('cellModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Browse variables button
        document.getElementById('btn-browse-vars').addEventListener('click', () => {
            this.picker.open(this.selectedRowVar ? 'col' : 'row');
        });

        // Close browse button
        document.getElementById('btn-close-browse').addEventListener('click', () => {
            document.getElementById('browse-panel').classList.add('hidden');
        });

        // Merge checkbox
        document.getElementById('merge').addEventListener('change', (e) => {
            this.mergeEnabled = e.target.checked;
            if (this.currentCrosstab) {
                this.displayCrosstab();
            }
        });
    }

    updateVariableInfo() {
        const infoPanel = document.getElementById('variable-info');
        const descriptions = document.getElementById('var-descriptions');

        if (this.selectedRowVar || this.selectedColVar) {
            let html = '';

            if (this.selectedRowVar) {
                const label = this.labelParser.getVariableLabel(this.selectedRowVar);
                const sccsNum = this.labelParser.getSccsNum(this.selectedRowVar);
                const cat = this.labelParser.getCategory(this.selectedRowVar);
                html += `<div class="var-description"><strong>Row Variable:</strong> ${sccsNum}. ${label}`;
                if (cat) html += ` <span class="var-category">[${cat}]</span>`;
                html += `</div>`;
            }

            if (this.selectedColVar) {
                const label = this.labelParser.getVariableLabel(this.selectedColVar);
                const sccsNum = this.labelParser.getSccsNum(this.selectedColVar);
                const cat = this.labelParser.getCategory(this.selectedColVar);
                html += `<div class="var-description"><strong>Column Variable:</strong> ${sccsNum}. ${label}`;
                if (cat) html += ` <span class="var-category">[${cat}]</span>`;
                html += `</div>`;
            }

            descriptions.innerHTML = html;
            infoPanel.classList.remove('hidden');
        } else {
            infoPanel.classList.add('hidden');
        }
    }

    generateCrosstab() {
        const rowVar = this.selectedRowVar;
        const colVar = this.selectedColVar;
        const useColor = document.getElementById('colour').checked;
        const showStats = document.getElementById('expected').checked;
        const includeMissing = document.getElementById('missing').checked;

        if (!rowVar || !colVar) {
            alert('Please select both row and column variables');
            return;
        }

        // Generate crosstab
        this.currentCrosstab = this.crosstabEngine.crosstab(rowVar, colVar, includeMissing);

        // Calculate statistics if requested
        if (showStats) {
            this.currentStats = this.crosstabEngine.calculateStatistics(this.currentCrosstab);
        } else {
            this.currentStats = null;
        }

        // Display results
        this.displayCrosstab();

        // Show results panel
        this.showPanel('results-panel');
        document.getElementById('results-panel').classList.remove('hidden');
    }

    displayCrosstab() {
        const container = document.getElementById('crosstab-container');
        const statsContainer = document.getElementById('statistics-container');
        const chiSquareContainer = document.getElementById('chi-square-summary');
        const columnVarDisplay = document.getElementById('column-var-display');

        const { rowVar, colVar, rowValues, colValues, cellCounts, rowTotals, colTotals, grandTotal } = this.currentCrosstab;

        // Get variable labels
        const rowVarLabel = this.labelParser.getVariableLabel(rowVar);
        const colVarLabel = this.labelParser.getVariableLabel(colVar);

        // Display column variable name in styled box
        const colSccsNum = this.labelParser.getSccsNum(colVar);
        const rowSccsNum = this.labelParser.getSccsNum(rowVar);
        columnVarDisplay.textContent = `${colSccsNum} - ${colVarLabel}`;

        // Build table
        let html = '<table class="crosstab-table">';

        // Header row
        html += '<thead><tr>';
        html += `<th class="row-header">${rowSccsNum} - ${rowVarLabel}</th>`;

        for (const cv of colValues) {
            const colLabel = cv === null ? 'Missing' : this.labelParser.getValueLabel(colVar, cv);
            const colDisplay = cv === null ? '.' : cv;
            html += `<th>${colDisplay}: ${colLabel}</th>`;
        }
        html += '<th>Total</th></tr></thead><tbody>';

        // Calculate color range based on deviation from expected if enabled
        let maxPositiveDeviation = 0;  // max (observed - expected) for green scale
        let maxNegativeDeviation = 0;  // max (expected - observed) for red scale

        if (document.getElementById('colour').checked && this.currentStats) {
            const expected = this.currentStats.expected;
            for (const [key, observed] of Object.entries(cellCounts)) {
                if (expected[key] > 0) {
                    const deviation = observed - expected[key];
                    if (deviation > 0) {
                        maxPositiveDeviation = Math.max(maxPositiveDeviation, deviation);
                    } else {
                        maxNegativeDeviation = Math.max(maxNegativeDeviation, -deviation);
                    }
                }
            }
        }

        // Data rows
        for (const rv of rowValues) {
            const rowLabel = rv === null ? 'Missing' : this.labelParser.getValueLabel(rowVar, rv);
            const rowDisplay = rv === null ? '.' : rv;
            html += `<tr>`;
            html += `<td class="row-header">${rowDisplay}: ${rowLabel}</td>`;

            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                const count = cellCounts[key];
                const percentage = grandTotal > 0 ? ((count / grandTotal) * 100).toFixed(1) : 0;

                let bgColor = '';
                if (document.getElementById('colour').checked && this.currentStats && count > 0) {
                    const expected = this.currentStats.expected[key];
                    if (expected && expected > 0) {
                        const deviation = count - expected;
                        bgColor = this.getDeviationColor(deviation, maxPositiveDeviation, maxNegativeDeviation);
                    }
                }

                html += `<td class="cell-value" style="background-color: ${bgColor}; cursor: pointer;" data-row="${rv}" data-col="${cv}">`;
                html += `<span class="count">${count}</span>`;
                if (count > 0) {
                    html += `<span class="percentage">(${percentage}%)</span>`;
                }
                html += `</td>`;
            }

            // Row total
            html += `<td class="total">${rowTotals[rv]}</td>`;
            html += `</tr>`;
        }

        // Column totals row
        html += '<tr>';
        html += '<td class="row-header"><strong>Total</strong></td>';
        for (const cv of colValues) {
            html += `<td class="total">${colTotals[cv]}</td>`;
        }
        html += `<td class="grand-total">${grandTotal}</td>`;
        html += '</tr>';

        html += '</tbody></table>';
        container.innerHTML = html;

        // Add click handlers for cells
        container.querySelectorAll('.cell-value').forEach(cell => {
            cell.addEventListener('click', (e) => {
                const rowValStr = e.currentTarget.dataset.row;
                const colValStr = e.currentTarget.dataset.col;
                const rowVal = rowValStr === 'null' ? null : parseInt(rowValStr);
                const colVal = colValStr === 'null' ? null : parseInt(colValStr);
                this.showCellDetail(rowVal, colVal);
            });
        });

        // Display statistics if requested
        if (this.currentStats) {
            this.displayStatistics();
        } else {
            statsContainer.classList.add('hidden');
            chiSquareContainer.classList.add('hidden');
        }
    }

    getBackgroundColor(value, min, max) {
        if (max === min) return 'rgb(255, 255, 255)';

        // Scale from 0 to 1
        const normalized = (value - min) / (max - min);

        // Interpolate between white (255, 255, 255) and dark red (180, 0, 0)
        const r = Math.round(255 - (normalized * 75));
        const g = Math.round(255 - (normalized * 255));
        const b = Math.round(255 - (normalized * 255));

        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Get background color based on deviation from expected value
     * Red scale for below expected, green scale for above expected
     */
    getDeviationColor(deviation, maxPos, maxNeg) {
        // No deviation - white
        if (deviation === 0 || (maxPos === 0 && maxNeg === 0)) {
            return 'rgb(255, 255, 255)';
        }

        if (deviation > 0) {
            // Above expected - green scale
            // White (255,255,255) to medium green (49, 146, 49)
            if (maxPos === 0) return 'rgb(255, 255, 255)';
            const intensity = deviation / maxPos;
            const r = Math.round(255 - (intensity * 206));   // 255 - 49 = 206
            const g = Math.round(255 - (intensity * 109));    // 255 - 146 = 109
            const b = Math.round(255 - (intensity * 206));
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Below expected - red scale
            // White (255,255,255) to medium red (195, 49, 49)
            if (maxNeg === 0) return 'rgb(255, 255, 255)';
            const intensity = Math.abs(deviation) / maxNeg;
            const r = Math.round(255 - (intensity * 60));    // 255 - 195 = 60
            const g = Math.round(255 - (intensity * 206));
            const b = Math.round(255 - (intensity * 206));
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    displayStatistics() {
        const statsContainer = document.getElementById('statistics-container');
        const chiSquareContainer = document.getElementById('chi-square-summary');
        const { rowVar, colVar, rowValues, colValues, cellCounts, grandTotal } = this.currentCrosstab;
        const stats = this.currentStats;

        statsContainer.classList.remove('hidden');
        chiSquareContainer.classList.remove('hidden');

        let html = '<div class="stats-section">';

        // Observed minus Expected table
        html += '<h3>Observed - Expected</h3>';
        html += this.buildStatsTable(stats.observedMinusExpected, (val) => {
            const sign = val >= 0 ? '+' : '';
            return `<span class="${val >= 0 ? 'positive' : 'negative'}">${sign}${val.toFixed(2)}</span>`;
        });

        // Chi-square contributions table
        html += '<h3>Chi-Square Contributions</h3>';
        html += this.buildStatsTable(stats.chiSquareContributions, (val) => {
            return val.toFixed(2);
        });

        html += '</div>';
        statsContainer.innerHTML = html;

        // Chi-square summary
        const significance = stats.isSignificant ?
            '<span class="significant">&#10003; Significant (p <= 0.05)</span>' :
            '<span>Not significant (p > 0.05)</span>';

        chiSquareContainer.innerHTML = `
            <div class="chi-square-summary">
                <h3>Chi-Square Test of Independence</h3>
                <div class="chi-square-metric">
                    <span class="label">Chi-Square Value:</span>
                    <span class="value">${stats.totalChiSquare.toFixed(4)}</span>
                </div>
                <div class="chi-square-metric">
                    <span class="label">Degrees of Freedom:</span>
                    <span class="value">${stats.degreesOfFreedom}</span>
                </div>
                <div class="chi-square-metric">
                    <span class="label">P-value:</span>
                    <span class="value">${stats.pValue}</span>
                </div>
                <div class="chi-square-metric ${stats.isSignificant ? 'significant' : ''}">
                    <span class="label">Result:</span>
                    <span class="value">${significance}</span>
                </div>
            </div>
        `;
    }

    buildStatsTable(data, valueFormatter) {
        const { rowVar, colVar, rowValues, colValues } = this.currentCrosstab;

        let html = '<table class="stats-table"><thead><tr>';
        html += `<th>${this.labelParser.getVariableLabel(rowVar)} \\ ${this.labelParser.getVariableLabel(colVar)}</th>`;

        for (const cv of colValues) {
            const colDisplay = cv === null ? '.' : cv;
            html += `<th>${colDisplay}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (const rv of rowValues) {
            const rowDisplay = rv === null ? '.' : rv;
            html += `<tr><td><strong>${rowDisplay}</strong></td>`;
            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                const val = data[key] || 0;
                html += `<td>${valueFormatter(val)}</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
    }

    showCellDetail(rowVal, colVal) {
        const { rowVar, colVar } = this.currentCrosstab;
        const caseIds = this.crosstabEngine.getCellCases(this.currentCrosstab, rowVal, colVal);

        const rowLabel = rowVal === null ? 'Missing' : this.labelParser.getValueLabel(rowVar, rowVal);
        const colLabel = colVal === null ? 'Missing' : this.labelParser.getValueLabel(colVar, colVal);
        const rowDisplay = rowVal === null ? '.' : rowVal;
        const colDisplay = colVal === null ? '.' : colVal;

        const modal = document.getElementById('cellModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        title.textContent = `Cell: ${rowDisplay} (${rowLabel}) x ${colDisplay} (${colLabel})`;

        let html = `<p><strong>${caseIds.length} societies in this cell</strong></p>`;
        html += '<div class="society-list">';

        if (caseIds.length === 0) {
            html += '<p>No societies in this cell.</p>';
        } else {
            for (const caseId of caseIds) {
                const society = this.owlLookup.getSociety(caseId);
                // Get first sentence of description
                let firstSentence = '';
                let fullDesc = society.description || '';
                if (fullDesc) {
                    const match = fullDesc.match(/^.*?[.!?](?:\s|$)/);
                    firstSentence = match ? match[0] : fullDesc;
                }

                html += `
                    <div class="society-item" data-case-id="${caseId}">
                        <div class="society-name">${caseId}. ${society.name} (eHRAF: ${society.term})${society.highest_bt ? ' / ' + society.highest_bt : ''}${society.bt ? ' / ' + society.bt : ''}</div>
                        <div class="society-info">
                            ${society.year ? `Year: ${society.year}` : ''}
                            ${society.subsistence_type ? ` | Subsistence: ${society.subsistence_type}` : ''}
                        </div>
                        <div class="society-description" data-full-desc="${encodeURIComponent(fullDesc)}">
                            Description: ${firstSentence}<span class="desc-toggle">[More]</span>
                        </div>
                        <div class="society-buttons">
                            <button class="btn-info ehraf-btn" data-owc-id="${society.id}" title="Opens in new tab">eHRAF Info</button>
                            <button class="btn-info sccs-btn" data-sccs-group="${society.sccs_group}" title="Opens in new tab">D-Place SCCS Info</button>
                        </div>
                    </div>
                `;
            }
        }

        html += '</div>';
        body.innerHTML = html;
        modal.classList.add('active');

        // Add click handlers for description toggles
        const toggleHandler = (e) => {
            const descDiv = e.target.closest('.society-description');
            const fullDesc = decodeURIComponent(descDiv.dataset.fullDesc);

            if (e.target.textContent === '[More]') {
                descDiv.innerHTML = `Description: ${fullDesc}<span class="desc-toggle">[Less]</span>`;
            } else {
                const match = fullDesc.match(/^.*?[.!?](?:\s|$)/);
                const firstSentence = match ? match[0] : fullDesc;
                descDiv.innerHTML = `Description: ${firstSentence}<span class="desc-toggle">[More]</span>`;
            }

            // Re-attach click handler to the new toggle
            descDiv.querySelector('.desc-toggle').addEventListener('click', toggleHandler);
        };

        body.querySelectorAll('.desc-toggle').forEach(toggle => {
            toggle.addEventListener('click', toggleHandler);
        });

        // Add click handlers for eHRAF Info buttons
        body.querySelectorAll('.ehraf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const owcId = e.target.dataset.owcId;
                window.open(`https://ehrafworldcultures.yale.edu/collection?owc=${owcId}`, '_blank');
            });
        });

        // Add click handlers for D-Place SCCS Info buttons
        body.querySelectorAll('.sccs-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sccsGroup = e.target.dataset.sccsGroup;
                window.open(`https://d-place.org/society/SCCS${sccsGroup}`, '_blank');
            });
        });
    }

    closeModal() {
        document.getElementById('cellModal').classList.remove('active');
    }

    showPanel(panelId) {
        // Hide all panels except selection panel
        document.querySelectorAll('.panel').forEach(panel => {
            if (panel.id !== 'selection-panel') {
                panel.classList.add('hidden');
            }
        });
    }

    showError(message) {
        alert('Error: ' + message);
        console.error(message);
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EthnoAtlasApp();
});
