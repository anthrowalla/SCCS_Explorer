/**
 * Main Application Module
 * Coordinates all components and handles UI interactions
 */

import DataParser from './dataParser.js';
import LabelParser from './labelParser.js';
import CrosstabEngine from './crosstab.js';
import OwcLookup from './owcLookup.js';
import VariablePicker from './variablePicker.js';
import InformationMetrics from './informationMetrics.js';

class EthnoAtlasApp {
    constructor() {
        this.dataParser = new DataParser();
        this.labelParser = new LabelParser();
        this.owlLookup = new OwcLookup();
        this.crosstabEngine = null;
        this.infoMetrics = new InformationMetrics();
        this.currentCrosstab = null;
        this.currentStats = null;
        this.currentInfoMetrics = null;
        this.mergeEnabled = false;
        this.hasMerged = false;
        this.rowMergeMap = {};
        this.colMergeMap = {};
        this.picker = null;
        this.summarizeLabels = localStorage.getItem('summarizeLabels') === 'true';

        // Selected variable state
        this.selectedRowVar = null;
        this.selectedColVar = null;

        // Dataset configuration
        this.datasetConfigs = {
            sccs: {
                name: 'SCCS sample',
                dataFile: 'resources/SCCS.data',
                labelFile: 'resources/SCCS.lbl',
                societyFile: 'resources/SCCS.glbl',
                varInfoFile: 'resources/SCCS.varinfo',
                owcFile: 'resources/owc_info_unified.json'
            },
            ea_vars: {
                name: 'SCCS sample with EA variables',
                dataFile: 'resources/EthnoAtlas.data',
                labelFile: 'resources/EthnoAtlas.lbl',
                societyFile: 'resources/EthnoAtlas.glbl',
                varInfoFile: null,  // Main branch doesn't have varinfo
                owcFile: 'resources/owc_info_unified.json'
            },
            ea: {
                name: 'EA sample',
                dataFile: 'resources/EA.data',
                labelFile: 'resources/EA.lbl',
                societyFile: 'resources/EA.glbl',
                varInfoFile: 'resources/EA.varinfo',
                owcFile: 'resources/owc_info_unified.json'
            }
        };

        // Current dataset (from localStorage or default to 'sccs')
        this.currentDataset = localStorage.getItem('selectedDataset') || 'sccs';

        // Configuration - paths relative to the HTML file
        this.config = this.datasetConfigs[this.currentDataset];

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
            const loadPromises = [
                this.dataParser.loadData(this.config.dataFile),
                this.labelParser.loadLabels(this.config.labelFile),
            ];
            if (this.config.owcFile) {
                loadPromises.push(this.owlLookup.loadOwcInfo(this.config.owcFile));
            } else {
                loadPromises.push(Promise.resolve(null));
            }
            if (this.config.varInfoFile) {
                loadPromises.push(this.labelParser.loadVarInfo(this.config.varInfoFile));
            } else {
                loadPromises.push(Promise.resolve(null));
            }

            const [dataResult, labelsResult, owcResult, varInfoResult] = await Promise.allSettled(loadPromises);

            // Check for errors
            const errors = [];
            if (dataResult.status === 'rejected') errors.push(`Data file: ${dataResult.reason?.message || dataResult.reason}`);
            if (labelsResult.status === 'rejected') errors.push(`Label file: ${labelsResult.reason?.message || labelsResult.reason}`);
            if (this.config.owcFile && owcResult.status === 'rejected') errors.push(`OWC info file: ${owcResult.reason?.message || owcResult.reason}`);
            if (this.config.varInfoFile && varInfoResult.status === 'rejected') errors.push(`VarInfo file: ${varInfoResult.reason?.message || varInfoResult.reason}`);

            if (errors.length > 0) {
                throw new Error('Failed to load data files:\n' + errors.join('\n'));
            }

            // Initialize crosstab engine
            this.crosstabEngine = new CrosstabEngine(this.dataParser, this.labelParser);

            // Set current dataset for OWC lookup
            this.owlLookup.setCurrentDataset(this.currentDataset);

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
        // Check if the variable has changed and clear merge selectors if needed
        if (slot === 'row') {
            if (this.selectedRowVar !== null && this.selectedRowVar !== varNum) {
                // Row variable changed, clear row merge selectors
                this.rowMergeMap = {};
            }
            this.selectedRowVar = varNum;
        } else {
            if (this.selectedColVar !== null && this.selectedColVar !== varNum) {
                // Column variable changed, clear column merge selectors
                this.colMergeMap = {};
            }
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

        // Build file list based on current dataset
        let fileList = '';
        if (this.config.dataFile) fileList += `<li>${this.config.dataFile}</li>`;
        if (this.config.labelFile) fileList += `<li>${this.config.labelFile}</li>`;
        if (this.config.societyFile) fileList += `<li>${this.config.societyFile}</li>`;
        if (this.config.varInfoFile) fileList += `<li>${this.config.varInfoFile}</li>`;
        if (this.config.owcFile) fileList += `<li>${this.config.owcFile}</li>`;

        container.innerHTML = `
            <div class="panel" style="background-color: #fee; border: 2px solid #c00;">
                <h2 style="color: #c00;">Error Loading Data Files</h2>
                <p><strong>The application could not load the required data files for <em>${this.config.name}</em>.</strong></p>
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
                        <ul>${fileList}</ul>
                    </li>
                    <li><strong>Try a different dataset</strong> - Switch to another dataset using the radio buttons above.
                        <ul>
                            <li>SCCS sample has ~1781 variables for 186 societies</li>
                            <li>SCCS sample with EA variables has 86 variables</li>
                            <li>EA sample has 94 variables for 1291 societies</li>
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
            if (!this.mergeEnabled) {
                // Clear merge maps and regenerate original crosstab
                this.rowMergeMap = {};
                this.colMergeMap = {};
                this.hasMerged = false;
                this.generateCrosstab();
            } else if (this.currentCrosstab) {
                this.displayCrosstab();
            }
        });

        // Info metrics checkbox - toggle info options visibility
        const infoMetricsCheckbox = document.getElementById('info-metrics');
        const infoOptionsGroup = document.getElementById('info-options-group');
        if (infoMetricsCheckbox && infoOptionsGroup) {
            infoMetricsCheckbox.addEventListener('change', (e) => {
                infoOptionsGroup.style.display = e.target.checked ? 'block' : 'none';
                if (this.currentCrosstab) {
                    this.displayCrosstab();
                }
            });
        }

        // Info options checkboxes - refresh display when changed
        ['info-show-joint', 'info-show-rc', 'info-show-cr'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (this.currentCrosstab) {
                        this.displayCrosstab();
                    }
                });
            }
        });

        // Expected checkbox - toggle alpha input visibility
        const expectedCheckbox = document.getElementById('expected');
        const alphaInputGroup = document.getElementById('alpha-input-group');
        if (expectedCheckbox && alphaInputGroup) {
            alphaInputGroup.style.display = expectedCheckbox.checked ? 'inline-flex' : 'none';
            expectedCheckbox.addEventListener('change', (e) => {
                alphaInputGroup.style.display = e.target.checked ? 'inline-flex' : 'none';
            });
        }

        // Summarize labels checkbox
        const summarizeLabelsCheckbox = document.getElementById('summarize-labels');
        if (summarizeLabelsCheckbox) {
            // Set initial state
            summarizeLabelsCheckbox.checked = this.summarizeLabels;
            summarizeLabelsCheckbox.addEventListener('change', (e) => {
                this.summarizeLabels = e.target.checked;
                localStorage.setItem('summarizeLabels', this.summarizeLabels);
                this.updateValueLabels();
            });
        }

        // Dataset radio buttons
        const datasetRadios = document.querySelectorAll('input[name="dataset"]');
        datasetRadios.forEach(radio => {
            // Set initial state based on currentDataset
            if (radio.value === this.currentDataset) {
                radio.checked = true;
            }
            // Add change listener
            radio.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    await this.switchDataset(e.target.value);
                }
            });
        });
    }

    async switchDataset(datasetId) {
        if (datasetId === this.currentDataset) {
            return; // Already on this dataset
        }

        console.log(`Switching to dataset: ${datasetId}`);

        // Store previous dataset in case of error
        const previousDataset = this.currentDataset;
        const previousConfig = this.config;

        try {
            // Update config temporarily
            this.config = this.datasetConfigs[datasetId];

            // Clear selections
            this.selectedRowVar = null;
            this.selectedColVar = null;
            this.rowMergeMap = {};
            this.colMergeMap = {};
            this.currentCrosstab = null;
            this.currentStats = null;
            this.currentInfoMetrics = null;
            this.mergeEnabled = false;
            this.hasMerged = false;

            // Hide results panel and show selection panel
            document.getElementById('results-panel').classList.add('hidden');
            document.getElementById('selection-panel').classList.remove('hidden');
            document.getElementById('dataset-panel').classList.remove('hidden');
            document.getElementById('cellModal').classList.remove('active');

            // Clear variable info
            document.getElementById('variable-info').classList.add('hidden');
            document.getElementById('var-descriptions').innerHTML = '';

            // Clear picker inputs
            document.querySelectorAll('.var-picker-input').forEach(input => {
                input.value = '';
                input.dataset.varNum = '';
            });

            // Show loading message
            this.showLoading('Loading dataset files...');

            // Reload data
            const loadPromises = [
                this.dataParser.loadData(this.config.dataFile),
                this.labelParser.loadLabels(this.config.labelFile),
            ];
            if (this.config.owcFile) {
                loadPromises.push(this.owlLookup.loadOwcInfo(this.config.owcFile));
            } else {
                loadPromises.push(Promise.resolve(null));
            }
            if (this.config.varInfoFile) {
                loadPromises.push(this.labelParser.loadVarInfo(this.config.varInfoFile));
            } else {
                loadPromises.push(Promise.resolve(null));
            }

            const [dataResult, labelsResult, owcResult, varInfoResult] = await Promise.allSettled(loadPromises);

            // Check for errors
            const errors = [];
            if (dataResult.status === 'rejected') errors.push(`Data file: ${dataResult.reason?.message || dataResult.reason}`);
            if (labelsResult.status === 'rejected') errors.push(`Label file: ${labelsResult.reason?.message || labelsResult.reason}`);
            if (this.config.owcFile && owcResult.status === 'rejected') errors.push(`OWC info file: ${owcResult.reason?.message || owcResult.reason}`);
            if (this.config.varInfoFile && varInfoResult.status === 'rejected') errors.push(`VarInfo file: ${varInfoResult.reason?.message || varInfoResult.reason}`);

            if (errors.length > 0) {
                throw new Error('Failed to load data files:\n' + errors.join('\n'));
            }

            // Success! Update current dataset and save to localStorage
            this.currentDataset = datasetId;
            localStorage.setItem('selectedDataset', datasetId);

            // Recreate crosstab engine with new data
            this.crosstabEngine = new CrosstabEngine(this.dataParser, this.labelParser);

            // Set current dataset for OWC lookup
            this.owlLookup.setCurrentDataset(datasetId);

            // Recreate variable picker with new data
            this.picker = new VariablePicker(this.labelParser, this.dataParser, (slot, varNum) => {
                this.onVariableSelected(slot, varNum);
            });

            this.hideLoading();
            console.log(`Switched to ${this.config.name}`);
            console.log(`Loaded ${this.dataParser.getCaseCount()} societies with ${this.dataParser.getVariableCount()} variables`);
            console.log(`Categories: ${this.labelParser.getCategories().join(', ')}`);

        } catch (error) {
            this.hideLoading();
            console.error('Error switching dataset:', error);
            // Revert to previous dataset
            this.config = previousConfig;
            this.currentDataset = previousDataset;
            localStorage.setItem('selectedDataset', previousDataset);

            // Update radio button to previous selection
            const previousRadio = document.querySelector(`input[value="${previousDataset}"]`);
            if (previousRadio) {
                previousRadio.checked = true;
            }

            // Show error
            alert(`Error loading ${this.datasetConfigs[datasetId].name}: ${error.message}\n\nReverted to ${this.datasetConfigs[previousDataset].name}.`);
        }
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

        // Calculate statistics if requested or if colour coding is enabled
        // Get alpha value from input field
        const alphaInput = document.getElementById('alpha-level');
        const alpha = alphaInput ? parseFloat(alphaInput.value) || 0.05 : 0.05;

        if (showStats || useColor) {
            this.currentStats = this.crosstabEngine.calculateStatistics(this.currentCrosstab, alpha);
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
        const infoMetricsContainer = document.getElementById('info-metrics-container');
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

        // Helper function to get merged label for a value
        const getMergedRowLabel = (rv) => {
            if (rv === null) return 'Missing';
            // Check if this is a merged group
            if (this.currentCrosstab.rowMergeGroups && this.currentCrosstab.rowMergeGroups[rv]) {
                const originalValues = this.currentCrosstab.rowMergeGroups[rv];
                // If it's a merge group (has multiple values or is a string group name)
                if (originalValues.length > 1 || typeof rv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(rowVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                // Single value in a merge group - use that value's label and code
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(rowVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            // Not merged - use the value as-is
            const label = this.getValueLabel(rowVar, rv);
            return `${rv}: ${label}`;
        };

        const getMergedColLabel = (cv) => {
            if (cv === null) return 'Missing';
            // Check if this is a merged group
            if (this.currentCrosstab.colMergeGroups && this.currentCrosstab.colMergeGroups[cv]) {
                const originalValues = this.currentCrosstab.colMergeGroups[cv];
                // If it's a merge group (has multiple values or is a string group name)
                if (originalValues.length > 1 || typeof cv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(colVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                // Single value in a merge group - use that value's label and code
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(colVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            // Not merged - use the value as-is
            const label = this.getValueLabel(colVar, cv);
            return `${cv}: ${label}`;
        };

        // Header row
        html += '<thead><tr>';
        html += `<th class="row-header">${rowSccsNum} - ${rowVarLabel}</th>`;

        for (const cv of colValues) {
            const colLabel = getMergedColLabel(cv);
            html += `<th>${colLabel}</th>`;
        }
        html += '<th>Total</th></tr>';

        // Column merge selects row (if merge is enabled and not yet merged)
        // OR merged state row (if merge has been performed)
        if (this.mergeEnabled) {
            if (this.hasMerged) {
                // Show merged state row with merge group labels
                html += '<tr class="merged-state-row">';
                html += '<th></th>';  // Empty cell for row header column
                for (const cv of colValues) {
                    // Get the merge label for this column
                    let mergeLabel = '';
                    if (this.currentCrosstab.colMergeGroups && this.currentCrosstab.colMergeGroups[cv]) {
                        const originalValues = this.currentCrosstab.colMergeGroups[cv];
                        mergeLabel = originalValues.map(v => v === null ? 'Missing' : v).join('|');
                    }
                    html += `<th class="merged-label">${mergeLabel}</th>`;
                }
                html += '<th></th></tr>';  // Empty cell for Total column
            } else {
                // Show merge selects
                html += '<tr class="merge-select-row">';
                html += '<th></th>';  // Empty cell for row header column
                for (const cv of colValues) {
                    const currentMerge = this.colMergeMap[cv] || 'none';
                    html += `<th><select class="col-merge-select" data-col-value="${cv}">`;
                    html += `<option value="none" ${currentMerge === 'none' ? 'selected' : ''}> </option>`;
                    html += `<option value="A" ${currentMerge === 'A' ? 'selected' : ''}>A</option>`;
                    html += `<option value="B" ${currentMerge === 'B' ? 'selected' : ''}>B</option>`;
                    html += `<option value="C" ${currentMerge === 'C' ? 'selected' : ''}>C</option>`;
                    html += `<option value="D" ${currentMerge === 'D' ? 'selected' : ''}>D</option>`;
                    html += `<option value="drop" ${currentMerge === 'drop' ? 'selected' : ''}>drop</option>`;
                    html += `</select></th>`;
                }
                html += '<th></th></tr>';  // Empty cell for Total column
            }
        }

        html += '</thead><tbody>';

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
            const rowLabel = getMergedRowLabel(rv);
            html += `<tr>`;

            // Row header with merge select or merged state label if enabled
            if (this.mergeEnabled) {
                html += `<td class="row-header">`;
                if (this.hasMerged) {
                    // Show merged state label instead of select
                    let mergeLabel = '';
                    if (this.currentCrosstab.rowMergeGroups && this.currentCrosstab.rowMergeGroups[rv]) {
                        const originalValues = this.currentCrosstab.rowMergeGroups[rv];
                        mergeLabel = originalValues.map(v => v === null ? 'Missing' : v).join('|');
                    }
                    html += `<span class="merged-label">${mergeLabel}</span> `;
                } else {
                    // Show merge select
                    const currentMerge = this.rowMergeMap[rv] || 'none';
                    html += `<select class="row-merge-select" data-row-value="${rv}">`;
                    html += `<option value="none" ${currentMerge === 'none' ? 'selected' : ''}> </option>`;
                    html += `<option value="1" ${currentMerge === '1' ? 'selected' : ''}>1</option>`;
                    html += `<option value="2" ${currentMerge === '2' ? 'selected' : ''}>2</option>`;
                    html += `<option value="3" ${currentMerge === '3' ? 'selected' : ''}>3</option>`;
                    html += `<option value="4" ${currentMerge === '4' ? 'selected' : ''}>4</option>`;
                    html += `<option value="drop" ${currentMerge === 'drop' ? 'selected' : ''}>drop</option>`;
                    html += `</select> `;
                }
                html += `${rowLabel}</td>`;
            } else {
                html += `<td class="row-header">${rowLabel}</td>`;
            }

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

        // Merge button row (if merge is enabled)
        if (this.mergeEnabled) {
            html += '<tr class="merge-button-row">';
            html += '<td></td>';  // Empty cell for row header column
            for (const cv of colValues) {
                html += '<td></td>';  // Empty cells for each data column
            }
            const buttonText = this.hasMerged ? 'Unmerge' : 'Merge';
            html += `<td><button id="btn-merge" class="btn-merge">${buttonText}</button></td>`;
            html += '</tr>';
        }

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

        // Add handlers for row merge selects
        container.querySelectorAll('.row-merge-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const rowValue = e.target.dataset.rowValue;
                const rv = rowValue === 'null' ? null : parseInt(rowValue);
                this.rowMergeMap[rv] = e.target.value;
            });
        });

        // Add handlers for column merge selects
        container.querySelectorAll('.col-merge-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const colValue = e.target.dataset.colValue;
                const cv = colValue === 'null' ? null : parseInt(colValue);
                this.colMergeMap[cv] = e.target.value;
            });
        });

        // Add handler for merge button
        const mergeBtn = container.querySelector('#btn-merge');
        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => {
                if (this.hasMerged) {
                    this.unmerge();
                } else {
                    this.performMerge();
                }
            });
        }

        // Display statistics if requested
        if (document.getElementById('expected').checked) {
            this.displayStatistics();
        } else {
            statsContainer.classList.add('hidden');
            chiSquareContainer.classList.add('hidden');
        }

        // Display information metrics if requested
        if (document.getElementById('info-metrics').checked) {
            this.displayInfoMetrics();
        } else {
            infoMetricsContainer.classList.add('hidden');
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

    /**
     * Summarize a label to first 5 words followed by '...'
     */
    summarizeLabel(label) {
        if (!label || typeof label !== 'string') return label;
        const words = label.trim().split(/\s+/);
        if (words.length <= 5) return label;
        return words.slice(0, 5).join(' ') + '...';
    }

    /**
     * Get value label, optionally summarized
     */
    getValueLabel(varNum, valueCode) {
        const label = this.labelParser.getValueLabel(varNum, valueCode);
        return this.summarizeLabels ? this.summarizeLabel(label) : label;
    }

    /**
     * Dynamically update all value labels in the current table
     */
    updateValueLabels() {
        if (!this.currentCrosstab) return;

        const container = document.getElementById('crosstab-container');
        if (!container) return;

        const { rowVar, colVar } = this.currentCrosstab;
        const table = container.querySelector('table');
        if (!table) return;

        // Helper to get merged label for rows
        const getRowLabel = (rv) => {
            if (rv === null) return 'Missing';
            if (this.currentCrosstab.rowMergeGroups && this.currentCrosstab.rowMergeGroups[rv]) {
                const originalValues = this.currentCrosstab.rowMergeGroups[rv];
                if (originalValues.length > 1 || typeof rv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(rowVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                // Single value in a merge group - use that value's label and code
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(rowVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            const label = this.getValueLabel(rowVar, rv);
            return `${rv}: ${label}`;
        };

        // Helper to get merged label for columns
        const getColLabel = (cv) => {
            if (cv === null) return 'Missing';
            if (this.currentCrosstab.colMergeGroups && this.currentCrosstab.colMergeGroups[cv]) {
                const originalValues = this.currentCrosstab.colMergeGroups[cv];
                if (originalValues.length > 1 || typeof cv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(colVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                // Single value in a merge group - use that value's label and code
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(colVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            const label = this.getValueLabel(colVar, cv);
            return `${cv}: ${label}`;
        };

        // Update column headers in thead
        const headerRow = table.querySelector('thead tr:first-child');
        if (headerRow) {
            const thCells = headerRow.querySelectorAll('th');
            for (let i = 1; i < thCells.length - 1; i++) {
                const cv = this.currentCrosstab.colValues[i - 1];
                if (cv !== undefined) {
                    thCells[i].textContent = getColLabel(cv);
                }
            }
        }

        // Update row headers in tbody
        const dataRows = table.querySelectorAll('tbody tr');
        dataRows.forEach((row, rowIndex) => {
            const rv = this.currentCrosstab.rowValues[rowIndex];
            if (rv === undefined) return;

            const rowHeader = row.querySelector('.row-header');
            if (!rowHeader) return;

            const label = getRowLabel(rv);
            const select = rowHeader.querySelector('select');

            if (select) {
                // Row has a merge select - preserve it and update the label text
                // Get all child nodes that are not the select
                const textNodes = Array.from(rowHeader.childNodes).filter(n => n !== select);
                textNodes.forEach(n => n.remove());
                // Insert the label after the select
                select.insertAdjacentText('afterend', ' ' + label);
            } else {
                rowHeader.textContent = label;
            }
        });

        // Update information metrics table if present
        const infoMetricsContainer = document.getElementById('info-metrics-container');
        if (infoMetricsContainer && !infoMetricsContainer.classList.contains('hidden')) {
            this.updateInfoMetricsLabels();
        }

        // Update statistics tables if present
        this.updateStatisticsLabels();
    }

    /**
     * Update labels in information metrics table
     */
    updateInfoMetricsLabels() {
        const infoMetricsContainer = document.getElementById('info-metrics-container');
        if (!infoMetricsContainer) return;

        const { rowVar, colVar } = this.currentCrosstab;
        const table = infoMetricsContainer.querySelector('.info-metrics-table');
        if (!table) return;

        // Helper to get merged label for rows
        const getRowLabel = (rv) => {
            if (rv === null) return 'Missing';
            if (this.currentCrosstab.rowMergeGroups && this.currentCrosstab.rowMergeGroups[rv]) {
                const originalValues = this.currentCrosstab.rowMergeGroups[rv];
                if (originalValues.length > 1 || typeof rv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(rowVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(rowVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            const label = this.getValueLabel(rowVar, rv);
            return `${rv}: ${label}`;
        };

        // Helper to get merged label for columns
        const getColLabel = (cv) => {
            if (cv === null) return 'Missing';
            if (this.currentCrosstab.colMergeGroups && this.currentCrosstab.colMergeGroups[cv]) {
                const originalValues = this.currentCrosstab.colMergeGroups[cv];
                if (originalValues.length > 1 || typeof cv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(colVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(colVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            const label = this.getValueLabel(colVar, cv);
            return `${cv}: ${label}`;
        };

        // Update column headers
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const thCells = headerRow.querySelectorAll('th');
            for (let i = 1; i < thCells.length - 1; i++) {
                const cv = this.currentCrosstab.colValues[i - 1];
                if (cv !== undefined) {
                    thCells[i].textContent = getColLabel(cv);
                }
            }
        }

        // Update row headers
        const dataRows = table.querySelectorAll('tbody tr:not(.col-contributions-row)');
        dataRows.forEach((row, rowIndex) => {
            const rv = this.currentCrosstab.rowValues[rowIndex];
            if (rv === undefined) return;

            const rowHeader = row.querySelector('.row-header');
            if (rowHeader) {
                rowHeader.textContent = getRowLabel(rv);
            }
        });
    }

    /**
     * Update labels in statistics tables
     */
    updateStatisticsLabels() {
        const statsContainer = document.getElementById('statistics-container');
        if (!statsContainer || statsContainer.classList.contains('hidden')) return;

        const { rowVar, colVar } = this.currentCrosstab;

        // Update labels in statistics tables
        statsContainer.querySelectorAll('table').forEach(table => {
            table.querySelectorAll('td:first-child, th:first-child').forEach(cell => {
                const text = cell.textContent;
                // Check if it matches a value pattern (e.g., "1: Label" or "2: Label")
                const match = text.match(/^(\d+):\s*(.+)$/);
                if (match) {
                    const valueCode = parseInt(match[1]);
                    const fullLabel = this.labelParser.getValueLabel(rowVar, valueCode);
                    const label = this.summarizeLabels ? this.summarizeLabel(fullLabel) : fullLabel;
                    cell.textContent = `${valueCode}: ${label}`;
                }
            });
        });
    }

    /**
     * Perform row and column merging based on merge maps
     */
    performMerge() {
        if (!this.currentCrosstab) return;

        // Collect rows to drop and merge mappings
        const rowsToDrop = [];
        const colsToDrop = [];
        const rowMergeFilter = {};
        const colMergeFilter = {};
        let hasRowMerge = false;
        let hasColMerge = false;

        for (const [key, value] of Object.entries(this.rowMergeMap)) {
            const numKey = key === 'null' ? null : parseInt(key);
            if (value === 'drop') {
                rowsToDrop.push(numKey);
            } else if (value !== 'none') {
                rowMergeFilter[numKey] = value;
                hasRowMerge = true;
            }
        }

        for (const [key, value] of Object.entries(this.colMergeMap)) {
            const numKey = key === 'null' ? null : parseInt(key);
            if (value === 'drop') {
                colsToDrop.push(numKey);
            } else if (value !== 'none') {
                colMergeFilter[numKey] = value;
                hasColMerge = true;
            }
        }

        // Start with original crosstab (need to regenerate from raw data)
        const rowVar = this.currentCrosstab.rowVar;
        const colVar = this.currentCrosstab.colVar;
        const includeMissing = document.getElementById('missing').checked;
        let mergedCrosstab = this.crosstabEngine.crosstab(rowVar, colVar, includeMissing);

        // Filter out dropped rows and columns
        if (rowsToDrop.length > 0) {
            mergedCrosstab.rowValues = mergedCrosstab.rowValues.filter(rv => !rowsToDrop.includes(rv));
            // Clean up cell counts and cases for dropped rows
            for (const key of Object.keys(mergedCrosstab.cellCounts)) {
                const [rv] = key.split(',').map(k => (k === '' || isNaN(k)) ? k : Number(k));
                if (rowsToDrop.includes(rv)) {
                    delete mergedCrosstab.cellCounts[key];
                    delete mergedCrosstab.cellCases[key];
                }
            }
            // Recalculate row totals based on remaining cells
            for (const rv of mergedCrosstab.rowValues) {
                mergedCrosstab.rowTotals[rv] = 0;
                for (const cv of mergedCrosstab.colValues) {
                    const key = `${rv},${cv}`;
                    mergedCrosstab.rowTotals[rv] += mergedCrosstab.cellCounts[key] || 0;
                }
            }
            // Remove totals for dropped rows
            for (const rv of rowsToDrop) {
                delete mergedCrosstab.rowTotals[rv];
            }
        }

        if (colsToDrop.length > 0) {
            mergedCrosstab.colValues = mergedCrosstab.colValues.filter(cv => !colsToDrop.includes(cv));
            // Clean up cell counts and cases for dropped columns
            for (const key of Object.keys(mergedCrosstab.cellCounts)) {
                const [, cv] = key.split(',').map(k => (k === '' || isNaN(k)) ? k : Number(k));
                if (colsToDrop.includes(cv)) {
                    delete mergedCrosstab.cellCounts[key];
                    delete mergedCrosstab.cellCases[key];
                }
            }
            // Recalculate column totals based on remaining cells
            for (const cv of mergedCrosstab.colValues) {
                mergedCrosstab.colTotals[cv] = 0;
                for (const rv of mergedCrosstab.rowValues) {
                    const key = `${rv},${cv}`;
                    mergedCrosstab.colTotals[cv] += mergedCrosstab.cellCounts[key] || 0;
                }
            }
            // Remove totals for dropped columns
            for (const cv of colsToDrop) {
                delete mergedCrosstab.colTotals[cv];
            }
        }

        // Apply merges
        if (hasRowMerge) {
            mergedCrosstab = this.crosstabEngine.mergeRows(mergedCrosstab, rowMergeFilter);
        }

        if (hasColMerge) {
            mergedCrosstab = this.crosstabEngine.mergeCols(mergedCrosstab, colMergeFilter);
        }

        // Recalculate grand total
        mergedCrosstab.grandTotal = Object.values(mergedCrosstab.rowTotals).reduce((a, b) => a + b, 0);

        // Update current crosstab
        this.currentCrosstab = mergedCrosstab;
        this.hasMerged = true;

        // Recalculate statistics if expected values or color coding is enabled
        const showStats = document.getElementById('expected').checked;
        const useColor = document.getElementById('colour').checked;

        if (showStats || useColor) {
            const alphaInput = document.getElementById('alpha-level');
            const alpha = alphaInput ? parseFloat(alphaInput.value) || 0.05 : 0.05;
            this.currentStats = this.crosstabEngine.calculateStatistics(mergedCrosstab, alpha);
        } else {
            this.currentStats = null;
        }

        // Redisplay
        this.displayCrosstab();
    }

    /**
     * Unmerge - regenerate the original crosstab with active merge selects
     */
    unmerge() {
        if (!this.currentCrosstab) return;

        // Keep merge maps intact to preserve user selections
        // Only reset the merged state
        this.hasMerged = false;

        // Regenerate the original crosstab from raw data
        const rowVar = this.currentCrosstab.rowVar;
        const colVar = this.currentCrosstab.colVar;
        const includeMissing = document.getElementById('missing').checked;

        this.currentCrosstab = this.crosstabEngine.crosstab(rowVar, colVar, includeMissing);

        // Recalculate statistics if expected values or color coding is enabled
        const showStats = document.getElementById('expected').checked;
        const useColor = document.getElementById('colour').checked;

        if (showStats || useColor) {
            const alphaInput = document.getElementById('alpha-level');
            const alpha = alphaInput ? parseFloat(alphaInput.value) || 0.05 : 0.05;
            this.currentStats = this.crosstabEngine.calculateStatistics(this.currentCrosstab, alpha);
        } else {
            this.currentStats = null;
        }

        // Redisplay
        this.displayCrosstab();
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
        const alpha = stats.alpha || 0.05;
        const significance = stats.isSignificant ?
            `<span class="significant">&#10003; Significant (p <= ${alpha})</span>` :
            `<span>Not significant (p > ${alpha})</span>`;

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

    displayInfoMetrics() {
        const infoMetricsContainer = document.getElementById('info-metrics-container');
        const { rowVar, colVar, rowValues, colValues } = this.currentCrosstab;

        // Calculate information metrics
        this.currentInfoMetrics = this.infoMetrics.calculateMetrics(this.currentCrosstab);
        const metrics = this.currentInfoMetrics;

        // Get merged label functions (same as used in main table)
        const getMergedRowLabel = (rv) => {
            if (rv === null) return 'Missing';
            if (this.currentCrosstab.rowMergeGroups && this.currentCrosstab.rowMergeGroups[rv]) {
                const originalValues = this.currentCrosstab.rowMergeGroups[rv];
                if (originalValues.length > 1 || typeof rv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(rowVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                // Single value in a merge group - use that value's label and code
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(rowVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            const label = this.getValueLabel(rowVar, rv);
            return `${rv}: ${label}`;
        };

        const getMergedColLabel = (cv) => {
            if (cv === null) return 'Missing';
            if (this.currentCrosstab.colMergeGroups && this.currentCrosstab.colMergeGroups[cv]) {
                const originalValues = this.currentCrosstab.colMergeGroups[cv];
                if (originalValues.length > 1 || typeof cv === 'string') {
                    return originalValues.map(v => {
                        if (v === null) return 'Missing';
                        const label = this.getValueLabel(colVar, v);
                        return `${v}: ${label}`;
                    }).join(', ');
                }
                // Single value in a merge group - use that value's label and code
                const singleValue = originalValues[0];
                if (singleValue === null) return 'Missing';
                const label = this.labelParser.getValueLabel(colVar, singleValue);
                const displayLabel = this.summarizeLabels ? this.summarizeLabel(label) : label;
                return `${singleValue}: ${displayLabel}`;
            }
            const label = this.getValueLabel(colVar, cv);
            return `${cv}: ${label}`;
        };

        // Build metrics summary and interaction table
        let html = '<div class="info-metrics-section">';
        html += '<h3>Information Theory Metrics (Shannon Entropy)</h3>';

        // Summary metrics
        html += '<div class="info-metrics-summary">';
        html += `<div class="metric-item"><span class="metric-label">Row Entropy H(R):</span><span class="metric-value">${this.infoMetrics.formatValue(metrics.rowEntropy)} bits</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Column Entropy H(C):</span><span class="metric-value">${this.infoMetrics.formatValue(metrics.colEntropy)} bits</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Joint Entropy H(R,C):</span><span class="metric-value">${this.infoMetrics.formatValue(metrics.jointEntropy)} bits</span></div>`;
        html += `<div class="metric-item"><span class="metric-label">Mutual Information I(R;C):</span><span class="metric-value">${this.infoMetrics.formatValue(metrics.mutualInformation)} bits</span></div>`;
        html += '</div>';

        // Interaction table
        html += '<h4>Cell-wise Interaction Contributions (Pointwise Mutual Information)</h4>';
        html += '<table class="info-metrics-table">';

        // Check which info options are enabled
        const showJoint = document.getElementById('info-show-joint').checked;
        const showRC = document.getElementById('info-show-rc').checked;
        const showCR = document.getElementById('info-show-cr').checked;

        // Header row
        html += '<thead><tr>';
        html += '<th class="row-header"></th>';
        for (const cv of colValues) {
            const colLabel = getMergedColLabel(cv);
            html += `<th>${colLabel}</th>`;
        }
        html += '<th class="row-total">H(R) contribution</th>';
        html += '</tr></thead><tbody>';

        // Data rows
        for (const rv of rowValues) {
            const rowLabel = getMergedRowLabel(rv);
            html += '<tr>';
            html += `<td class="row-header">${rowLabel}</td>`;

            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                const value = metrics.cellInteractions[key] || 0;
                const jointContrib = metrics.cellJointContributions[key] || 0;
                const condRC = metrics.cellConditionalRC[key] || 0;
                const condCR = metrics.cellConditionalCR[key] || 0;

                // Determine CSS class based on I(R;C) value
                let cellClass = 'interaction-cell';
                if (value > 0.001) {
                    cellClass += ' interaction-positive';
                } else if (value < -0.001) {
                    cellClass += ' interaction-negative';
                } else {
                    cellClass += ' interaction-neutral';
                }

                // Build cell content
                let cellContent = this.infoMetrics.formatValue(value);
                if (showJoint) {
                    cellContent += ` (${this.infoMetrics.formatValue(jointContrib)})`;
                }
                if (showRC) {
                    cellContent += ` [R|C ${this.infoMetrics.formatValue(condRC)}]`;
                }
                if (showCR) {
                    cellContent += ` [C|R ${this.infoMetrics.formatValue(condCR)}]`;
                }

                html += `<td class="${cellClass}">${cellContent}</td>`;
            }

            // Row entropy contribution
            const rowContrib = metrics.rowEntropyContributions[rv] || 0;
            html += `<td class="row-contribution">${this.infoMetrics.formatValue(rowContrib)}</td>`;
            html += '</tr>';
        }

        // Column entropy contributions row
        html += '<tr class="col-contributions-row">';
        html += '<td class="row-header">H(C) contribution</td>';
        for (const cv of colValues) {
            const colContrib = metrics.colEntropyContributions[cv] || 0;
            html += `<td class="col-contribution">${this.infoMetrics.formatValue(colContrib)}</td>`;
        }

        // Calculate sums for the corner cell
        const sumRowContribs = Object.values(metrics.rowEntropyContributions).reduce((a, b) => a + b, 0);
        const sumColContribs = Object.values(metrics.colEntropyContributions).reduce((a, b) => a + b, 0);

        // Corner cell with sums in different corners
        html += '<td class="corner-cell">';
        html += `<span class="corner-bottom-left">${this.infoMetrics.formatValue(sumColContribs)}</span>`;
        html += `<span class="corner-top-right">${this.infoMetrics.formatValue(sumRowContribs)}</span>`;
        html += '</td></tr>';

        html += '</tbody></table>';
        html += '</div>';

        infoMetricsContainer.innerHTML = html;
        infoMetricsContainer.classList.remove('hidden');
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

        const rowVarSccs = this.labelParser.getSccsNum(rowVar);
        const rowVarLabel = this.labelParser.getVariableLabel(rowVar);
        const colVarSccs = this.labelParser.getSccsNum(colVar);
        const colVarLabel = this.labelParser.getVariableLabel(colVar);

        const modal = document.getElementById('cellModal');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');

        title.innerHTML = `Rows: ${rowVarSccs} ${rowVarLabel}<br>Cols: ${colVarSccs} ${colVarLabel}<br>Cell: ${rowDisplay} (${rowLabel}) x ${colDisplay} (${colLabel})`;

        let html = `<p><strong>${caseIds.length} societies in this cell</strong></p>`;
        html += '<div class="society-list">';

        if (caseIds.length === 0) {
            html += '<p>No societies in this cell.</p>';
        } else {
            for (const caseId of caseIds) {
                const society = this.owlLookup.getSocietyByCaseId(caseId);
                const crossRefs = this.owlLookup.getCrossDatasetRefs(society.soc_id);

                // Get first sentence of description
                let firstSentence = '';
                let fullDesc = society.hraf_summary || '';
                if (fullDesc) {
                    const match = fullDesc.match(/^.*?[.!?](?:\s|$)/);
                    firstSentence = match ? match[0] : fullDesc;
                }

                // Build cross-references HTML as direct D-Place links
                let crossRefsHtml = '';
                if (crossRefs.length > 0) {
                    crossRefsHtml = '<div class="society-crossrefs">';
                    crossRefsHtml += '<strong>See also:</strong> ';
                    crossRefsHtml += crossRefs.map(ref => {
                        // Build D-Place URL for the cross-referenced society
                        let dplaceUrl = '';
                        if (ref.dataset === 'SCCS' && ref.case_id) {
                            dplaceUrl = `https://d-place.org/society/SCCS${ref.case_id}`;
                        } else if (ref.dataset === 'EA' && ref.soc_id) {
                            dplaceUrl = `https://d-place.org/society/${ref.soc_id}`;
                        }

                        if (dplaceUrl) {
                            return `<a href="${dplaceUrl}" target="_blank" class="crossref-link">${ref.dataset} ${ref.pref_name}</a>`;
                        }
                        return `${ref.dataset} ${ref.pref_name}`;
                    }).join(', ');
                    crossRefsHtml += '</div>';
                }

                // Build society info
                let infoHtml = '';
                if (society.focal_year) {
                    infoHtml += `Year: ${society.focal_year}`;
                }
                if (society.latitude && society.longitude) {
                    infoHtml += (infoHtml ? ' | ' : '') + `Location: ${society.latitude}, ${society.longitude}`;
                }
                if (society.subsistence_type) {
                    infoHtml += (infoHtml ? ' | ' : '') + `Subsistence: ${society.subsistence_type}`;
                }
                if (society.region && !society.bt) {
                    infoHtml += (infoHtml ? ' | ' : '') + `Region: ${society.region}`;
                }
                if (society.bt) {
                    infoHtml += (infoHtml ? ' | ' : '') + `Region: ${society.bt}`;
                }

                // Build buttons in correct order based on dataset
                let buttonsHtml = '<div class="society-buttons">';

                // For EA sample, the society comes from EA dataset
                // For SCCS sample, it comes from SCCS dataset
                const isEaDataset = society.dataset === 'EA';

                if (isEaDataset) {
                    // EA sample order: D-Place EA Info → eHRAF Info (if available) → D-Place SCCS Info (if cross-ref exists)
                    buttonsHtml += `<button class="btn-info dplace-btn" data-url="https://d-place.org/society/${society.soc_id}" title="Opens in new tab">D-Place EA Info</button>`;

                    if (society.group_id) {
                        buttonsHtml += `<button class="btn-info ehraf-btn" data-owc-id="${society.group_id}" title="Opens in new tab">eHRAF Info</button>`;
                    }

                    // Check if there's an SCCS cross-reference
                    const sccsRef = crossRefs.find(ref => ref.dataset === 'SCCS');
                    if (sccsRef && sccsRef.case_id) {
                        buttonsHtml += `<button class="btn-info dplace-btn" data-url="https://d-place.org/society/SCCS${sccsRef.case_id}" title="Opens in new tab">D-Place SCCS Info</button>`;
                    }
                } else {
                    // SCCS sample order: eHRAF Info (if available) → D-Place SCCS Info
                    if (society.group_id) {
                        buttonsHtml += `<button class="btn-info ehraf-btn" data-owc-id="${society.group_id}" title="Opens in new tab">eHRAF Info</button>`;
                    }

                    if (society.case_id) {
                        buttonsHtml += `<button class="btn-info dplace-btn" data-url="https://d-place.org/society/SCCS${society.case_id}" title="Opens in new tab">D-Place SCCS Info</button>`;
                    }
                }

                buttonsHtml += '</div>';

                // Build society name with proper formatting
                let societyNameHtml = '';
                if (isEaDataset) {
                    // For EA: use society ID (e.g., Aa1) and preferred name with alternatives
                    const altNames = society.alt_names && society.alt_names.length > 0
                        ? ` (${society.alt_names.slice(0, 3).join(', ')})`
                        : '';
                    societyNameHtml = `${society.soc_id}. ${society.pref_name}${altNames}`;
                } else {
                    // For SCCS: use case number and name
                    societyNameHtml = `${caseId}. ${society.pref_name}${society.hraf_name ? ` (${society.hraf_name})` : ''}`;
                }

                html += `
                    <div class="society-item" data-case-id="${caseId}">
                        <div class="society-name">${societyNameHtml}</div>
                        ${infoHtml ? `<div class="society-info">${infoHtml}</div>` : ''}
                        ${crossRefsHtml}
                        ${fullDesc ? `<div class="society-description" data-full-desc="${encodeURIComponent(fullDesc)}">
                            Description: ${firstSentence}<span class="desc-toggle">[More]</span>
                        </div>` : ''}
                        ${buttonsHtml}
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

        // Add click handlers for D-Place Info buttons
        body.querySelectorAll('.dplace-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.target.dataset.url;
                window.open(url, '_blank');
            });
        });
    }

    closeModal() {
        document.getElementById('cellModal').classList.remove('active');
    }

    showPanel(panelId) {
        // Hide all panels except selection panel and dataset panel
        document.querySelectorAll('.panel').forEach(panel => {
            if (panel.id !== 'selection-panel' && panel.id !== 'dataset-panel') {
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
