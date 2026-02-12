/**
 * Main Application Module
 * Coordinates all components and handles UI interactions
 */

import DataParser from './dataParser.js';
import LabelParser from './labelParser.js';
import CrosstabEngine from './crosstab.js';
import SocietyLookup from './societyLookup.js';

class EthnoAtlasApp {
    constructor() {
        this.dataParser = new DataParser();
        this.labelParser = new LabelParser();
        this.societyLookup = new SocietyLookup();
        this.crosstabEngine = null;
        this.currentCrosstab = null;
        this.currentStats = null;
        this.mergeEnabled = false;
        this.rowMergeMap = {};
        this.colMergeMap = {};

        // Configuration - paths relative to the HTML file
        this.config = {
            dataFile: 'resources/EthnoAtlas.data',
            labelFile: 'resources/EthnoAtlas.lbl',
            casesFile: 'resources/EthnoAtlas.cases',
            societyFile: 'resources/EthnoAtlas.glbl'
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
            console.log('  ', this.config.societyFile);

            // Load all data
            const [dataResult, labelsResult, societiesResult] = await Promise.allSettled([
                this.dataParser.loadData(this.config.dataFile),
                this.labelParser.loadLabels(this.config.labelFile),
                this.societyLookup.loadSocieties(this.config.societyFile)
            ]);

            // Check for errors
            const errors = [];
            if (dataResult.status === 'rejected') errors.push(`Data file: ${dataResult.reason.message}`);
            if (labelsResult.status === 'rejected') errors.push(`Label file: ${labelsResult.reason.message}`);
            if (societiesResult.status === 'rejected') errors.push(`Society file: ${societiesResult.reason.message}`);

            if (errors.length > 0) {
                throw new Error('Failed to load data files:\n' + errors.join('\n'));
            }

            // Try to load cases file (optional, for detailed info)
            try {
                const response = await fetch(this.config.casesFile);
                if (response.ok) {
                    const text = await response.text();
                    this.societyLookup.loadCasesFromText(text);
                    console.log('Loaded cases file for detailed society information');
                }
            } catch (e) {
                console.log('Cases file not available, using basic society info');
            }

            // Initialize crosstab engine
            this.crosstabEngine = new CrosstabEngine(this.dataParser, this.labelParser);

            // Update case count in footer
            const caseCount = this.dataParser.getCaseCount();
            document.getElementById('case-count').textContent = caseCount;

            // Populate variable dropdowns
            this.populateVariableSelects();

            // Set up event listeners
            this.setupEventListeners();

            this.hideLoading();
            console.log('Initialization complete!');
            console.log(`Loaded ${caseCount} societies with ${this.dataParser.getVariableCount()} variables`);

        } catch (error) {
            this.hideLoading();
            console.error('Error during initialization:', error);
            this.showErrorDetailed(error);
        }
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
                            <li>From the js/ directory, run: <code>python3 -m http.server 8000</code></li>
                            <li>Or: <code>npx http-server -p 8000</code></li>
                            <li>Then open: http://localhost:8000</li>
                        </ul>
                    </li>
                    <li><strong>Check file locations</strong> - The data files should be in the parent directory:
                        <ul>
                            <li>../EthnoAtlas.data</li>
                            <li>../EthnoAtlas.lbl</li>
                            <li>../EthnoAtlas.glbl</li>
                        </ul>
                    </li>
                </ol>
                <p><button onclick="location.reload()" class="btn-primary">Retry</button></p>
            </div>
        `;
    }

    populateVariableSelects() {
        const variables = this.labelParser.getAllVariables();

        const rowSelect = document.getElementById('row-var');
        const colSelect = document.getElementById('col-var');

        // Clear existing options (except the first one)
        rowSelect.innerHTML = '<option value="">Select variable...</option>';
        colSelect.innerHTML = '<option value="">Select variable...</option>';

        // Add options
        for (const v of variables) {
            const option1 = new Option(`${v.number}. ${v.name}`, v.number);
            const option2 = new Option(`${v.number}. ${v.name}`, v.number);
            rowSelect.add(option1);
            colSelect.add(option2);
        }
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('crosstab-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateCrosstab();
        });

        // Variable selection changes
        document.getElementById('row-var').addEventListener('change', () => this.updateVariableInfo());
        document.getElementById('col-var').addEventListener('change', () => this.updateVariableInfo());

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
            this.showBrowsePanel();
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
        const rowVar = document.getElementById('row-var').value;
        const colVar = document.getElementById('col-var').value;
        const infoPanel = document.getElementById('variable-info');
        const descriptions = document.getElementById('var-descriptions');

        if (rowVar || colVar) {
            let html = '';

            if (rowVar) {
                const label = this.labelParser.getVariableLabel(parseInt(rowVar));
                html += `<div class="var-description"><strong>Row Variable:</strong> ${rowVar}. ${label}</div>`;
            }

            if (colVar) {
                const label = this.labelParser.getVariableLabel(parseInt(colVar));
                html += `<div class="var-description"><strong>Column Variable:</strong> ${colVar}. ${label}</div>`;
            }

            descriptions.innerHTML = html;
            infoPanel.classList.remove('hidden');
        } else {
            infoPanel.classList.add('hidden');
        }
    }

    generateCrosstab() {
        const rowVar = parseInt(document.getElementById('row-var').value);
        const colVar = parseInt(document.getElementById('col-var').value);
        const useColor = document.getElementById('colour').checked;
        const showStats = document.getElementById('expected').checked;

        if (!rowVar || !colVar) {
            alert('Please select both row and column variables');
            return;
        }

        // Generate crosstab
        this.currentCrosstab = this.crosstabEngine.crosstab(rowVar, colVar);

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
        columnVarDisplay.textContent = `${colVar} - ${colVarLabel}`;

        // Build table
        let html = '<table class="crosstab-table">';

        // Header row
        html += '<thead><tr>';
        html += `<th class="row-header">${rowVarLabel}</th>`;

        for (const cv of colValues) {
            const colLabel = this.labelParser.getValueLabel(colVar, cv);
            html += `<th>${cv}: ${colLabel}</th>`;
        }
        html += '<th>Total</th></tr></thead><tbody>';

        // Calculate color range if enabled
        let minValue = Infinity;
        let maxValue = -Infinity;

        if (document.getElementById('colour').checked) {
            for (const count of Object.values(cellCounts)) {
                if (count > 0) {
                    minValue = Math.min(minValue, count);
                    maxValue = Math.max(maxValue, count);
                }
            }
        }

        // Data rows
        for (const rv of rowValues) {
            const rowLabel = this.labelParser.getValueLabel(rowVar, rv);
            html += `<tr>`;
            html += `<td class="row-header">${rv}: ${rowLabel}</td>`;

            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                const count = cellCounts[key];
                const percentage = grandTotal > 0 ? ((count / grandTotal) * 100).toFixed(1) : 0;

                let bgColor = '';
                if (document.getElementById('colour').checked && count > 0 && maxValue > minValue) {
                    bgColor = this.getBackgroundColor(count, minValue, maxValue);
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
                const rowVal = parseInt(e.currentTarget.dataset.row);
                const colVal = parseInt(e.currentTarget.dataset.col);
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
            '<span class="significant">✓ Significant (p < 0.05)</span>' :
            '<span>Not significant (p ≥ 0.05)</span>';

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
            html += `<th>${cv}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (const rv of rowValues) {
            html += `<tr><td><strong>${rv}</strong></td>`;
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

        const rowLabel = this.labelParser.getValueLabel(rowVar, rowVal);
        const colLabel = this.labelParser.getValueLabel(colVar, colVal);

        const modal = document.getElementById('cellModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        title.textContent = `Cell: ${rowVar}=${rowVal} (${rowLabel}) × ${colVar}=${colVal} (${colLabel})`;

        let html = `<p><strong>${caseIds.length} societies in this cell</strong></p>`;
        html += '<div class="society-list">';

        if (caseIds.length === 0) {
            html += '<p>No societies in this cell.</p>';
        } else {
            for (const caseId of caseIds) {
                const society = this.societyLookup.getSociety(caseId);
                html += `
                    <div class="society-item">
                        <div class="society-name">${caseId}. ${society.name}</div>
                        <div class="society-info">
                            ${society.year ? `Year: ${society.year}` : ''}
                            ${society.area ? ` | Area: ${society.area}` : ''}
                            ${society.classification ? ` | Classification: ${society.classification}` : ''}
                        </div>
                    </div>
                `;
            }
        }

        html += '</div>';
        body.innerHTML = html;
        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('cellModal').classList.remove('active');
    }

    showBrowsePanel() {
        const panel = document.getElementById('browse-panel');
        const listContainer = document.getElementById('variable-list');

        const variables = this.labelParser.getAllVariables();

        let html = '<div class="variable-list">';

        for (const v of variables) {
            html += `
                <div class="variable-item" data-var-num="${v.number}">
                    <div class="variable-number">${v.number}</div>
                    <div class="variable-name">${v.name}</div>
                </div>
            `;

            // Add value labels if they exist
            if (this.labelParser.hasValueLabels(v.number)) {
                const valueLabels = this.labelParser.getValueLabelsForVariable(v.number);
                html += '<div style="margin-left: 20px; margin-bottom: 15px; font-size: 0.9rem;">';
                for (const vl of valueLabels) {
                    html += `<div style="margin-left: 10px;">${vl.code}: ${vl.label}</div>`;
                }
                html += '</div>';
            }
        }

        html += '</div>';
        listContainer.innerHTML = html;

        // Add click handlers for variable items
        listContainer.querySelectorAll('.variable-item').forEach(item => {
            item.addEventListener('click', () => {
                const varNum = parseInt(item.dataset.varNum);
                const rowSelect = document.getElementById('row-var');
                const colSelect = document.getElementById('col-var');

                // Select in first empty select
                if (!rowSelect.value) {
                    rowSelect.value = varNum;
                } else if (!colSelect.value) {
                    colSelect.value = varNum;
                } else {
                    // Both filled, ask which to replace
                    if (confirm('Replace row variable? (Cancel for column variable)')) {
                        rowSelect.value = varNum;
                    } else {
                        colSelect.value = varNum;
                    }
                }

                panel.classList.add('hidden');
                this.updateVariableInfo();
            });
        });

        panel.classList.remove('hidden');
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
