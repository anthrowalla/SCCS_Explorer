/**
 * Crosstabulation Engine
 * JavaScript equivalent of the crossx C program
 * Performs cross-tabulation of two variables
 */

export class CrosstabEngine {
    constructor(dataParser, labelParser) {
        this.dataParser = dataParser;
        this.labelParser = labelParser;
    }

    /**
     * Generate a cross-tabulation of two variables
     * @param {number} rowVar - Row variable number (1-indexed)
     * @param {number} colVar - Column variable number (1-indexed)
     * @param {boolean} includeMissing - Whether to include missing (null) values
     * @returns {object} Crosstabulation result
     */
    crosstab(rowVar, colVar, includeMissing = false) {
        const data = this.dataParser.getAllData();
        const rowColIndex = rowVar - 1;
        const colColIndex = colVar - 1;

        // Get unique values for each variable
        let rowValues = this.dataParser.getUniqueValues(rowVar);
        let colValues = this.dataParser.getUniqueValues(colVar);

        // Filter out null unless includeMissing is true
        if (!includeMissing) {
            rowValues = rowValues.filter(v => v !== null);
            colValues = colValues.filter(v => v !== null);
        }

        // Sort values numerically (null sorts first when included)
        rowValues.sort((a, b) => {
            if (a === null) return -1;
            if (b === null) return 1;
            return a - b;
        });
        colValues.sort((a, b) => {
            if (a === null) return -1;
            if (b === null) return 1;
            return a - b;
        });

        // Initialize cell counts and case lists
        const cellCounts = {};
        const cellCases = {};
        const rowTotals = {};
        const colTotals = {};
        let grandTotal = 0;

        // Initialize structures
        for (const rv of rowValues) {
            rowTotals[rv] = 0;
            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                cellCounts[key] = 0;
                cellCases[key] = [];
            }
        }

        for (const cv of colValues) {
            colTotals[cv] = 0;
        }

        // Count occurrences
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rv = row[rowColIndex];
            const cv = row[colColIndex];

            // Skip cases with missing data only if not including missing
            if (!includeMissing && (rv === null || cv === null)) continue;
            // When including missing, skip only if BOTH are null (case has no data for either variable)
            if (includeMissing && rv === null && cv === null) continue;

            const key = `${rv},${cv}`;
            cellCounts[key]++;
            cellCases[key].push(i + 1); // Store 1-indexed case ID
            rowTotals[rv]++;
            colTotals[cv]++;
            grandTotal++;
        }

        return {
            rowVar,
            colVar,
            rowValues,
            colValues,
            cellCounts,
            cellCases,
            rowTotals,
            colTotals,
            grandTotal
        };
    }

    /**
     * Calculate statistics (expected values, O-E, chi-square)
     */
    calculateStatistics(crosstabResult, alpha = 0.05) {
        const { cellCounts, rowTotals, colTotals, grandTotal } = crosstabResult;

        const expected = {};
        const observedMinusExpected = {};
        const chiSquareContributions = {};
        let totalChiSquare = 0;

        for (const [key, observed] of Object.entries(cellCounts)) {
            const [rvStr, cvStr] = key.split(',');
            // Parse values - handle both numeric and string (merge group) keys
            // Try to convert to number first, fall back to string
            const rv = (rvStr === '' || isNaN(rvStr)) ? rvStr : Number(rvStr);
            const cv = (cvStr === '' || isNaN(cvStr)) ? cvStr : Number(cvStr);

            // Helper function to get total value with flexible key lookup
            const getTotal = (obj, key) => {
                if (key in obj) return obj[key];
                // Try with type conversion
                const numKey = Number(key);
                if (!isNaN(numKey) && numKey in obj) return obj[numKey];
                const strKey = String(key);
                if (strKey in obj) return obj[strKey];
                return 0;
            };

            const rowTotal = getTotal(rowTotals, rv);
            const colTotal = getTotal(colTotals, cv);

            // Expected value = (row_total * col_total) / grand_total
            const expectedVal = (rowTotal * colTotal) / grandTotal;
            expected[key] = expectedVal;

            // Observed - Expected
            const oe = observed - expectedVal;
            observedMinusExpected[key] = oe;

            // Chi-square contribution = (O-E)^2 / E
            if (expectedVal > 0) {
                const chi = (oe * oe) / expectedVal;
                chiSquareContributions[key] = chi;
                totalChiSquare += chi;
            } else {
                chiSquareContributions[key] = 0;
            }
        }

        // Calculate degrees of freedom
        const numRowValues = crosstabResult.rowValues.length;
        const numColValues = crosstabResult.colValues.length;
        const degreesOfFreedom = (numRowValues - 1) * (numColValues - 1);

        // Determine significance using the provided alpha level
        const isSignificant = this.isSignificant(totalChiSquare, degreesOfFreedom, alpha);

        return {
            expected,
            observedMinusExpected,
            chiSquareContributions,
            totalChiSquare,
            degreesOfFreedom,
            isSignificant,
            pValue: this.estimatePValue(totalChiSquare, degreesOfFreedom, alpha),
            alpha
        };
    }

    /**
     * Check if chi-square is significant at specified alpha level
     * Critical values from chi-square distribution table
     * @param {number} chiSquare - The chi-square test statistic
     * @param {number} df - Degrees of freedom
     * @param {number} alpha - Significance level (default 0.05)
     */
    isSignificant(chiSquare, df, alpha = 0.05) {
        // Critical values for different alpha levels
        const criticalValues = {
            0.001: {
                1: 10.828, 2: 13.816, 3: 16.266, 4: 18.467, 5: 20.515,
                6: 22.457, 7: 24.322, 8: 26.125, 9: 27.877, 10: 29.588,
                12: 32.909, 15: 37.697, 20: 45.315, 30: 59.703
            },
            0.01: {
                1: 6.635, 2: 9.210, 3: 11.345, 4: 13.277, 5: 15.086,
                6: 16.812, 7: 18.475, 8: 20.090, 9: 21.666, 10: 23.209,
                12: 26.217, 15: 30.578, 20: 37.566, 30: 50.892
            },
            0.05: {
                1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.070,
                6: 12.592, 7: 14.067, 8: 15.507, 9: 16.919, 10: 18.307,
                12: 21.026, 15: 24.996, 20: 31.410, 30: 43.773
            },
            0.10: {
                1: 2.706, 2: 4.605, 3: 6.251, 4: 7.779, 5: 9.236,
                6: 10.645, 7: 12.017, 8: 13.362, 9: 14.684, 10: 15.987,
                12: 18.549, 15: 22.307, 20: 28.412, 30: 40.256
            }
        };

        // Find closest alpha level
        const alphaLevels = [0.001, 0.01, 0.05, 0.10];
        let closestAlpha = alphaLevels[0];
        let minDiff = Math.abs(alpha - alphaLevels[0]);
        for (const level of alphaLevels) {
            const diff = Math.abs(alpha - level);
            if (diff < minDiff) {
                minDiff = diff;
                closestAlpha = level;
            }
        }

        const critical = criticalValues[closestAlpha][df];
        if (critical) {
            return chiSquare >= critical;
        }

        // Approximation: chiSquare >= df + 2*sqrt(df) for large df
        // Adjust based on alpha level
        const adjustment = {
            0.001: 8,
            0.01: 5,
            0.05: 0,
            0.10: -3
        }[closestAlpha] || 0;
        return chiSquare >= df + 2 * Math.sqrt(df) + adjustment;
    }

    /**
     * Estimate p-value (simplified approximation)
     * Uses same critical values as isSignificant() for consistency
     * @param {number} chiSquare - The chi-square test statistic
     * @param {number} df - Degrees of freedom
     * @param {number} alpha - Significance level (for display)
     */
    estimatePValue(chiSquare, df, alpha = 0.05) {
        // Critical values from chi-square distribution table
        const critical001 = {
            1: 10.828, 2: 13.816, 3: 16.266, 4: 18.467, 5: 20.515,
            6: 22.457, 7: 24.322, 8: 26.125, 9: 27.877, 10: 29.588,
            12: 32.909, 15: 37.697, 20: 45.315, 30: 59.703
        };
        const critical01 = {
            1: 6.635, 2: 9.210, 3: 11.345, 4: 13.277, 5: 15.086,
            6: 16.812, 7: 18.475, 8: 20.090, 9: 21.666, 10: 23.209,
            12: 26.217, 15: 30.578, 20: 37.566, 30: 50.892
        };
        const critical005 = {
            1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.070,
            6: 12.592, 7: 14.067, 8: 15.507, 9: 16.919, 10: 18.307,
            12: 21.026, 15: 24.996, 20: 31.410, 30: 43.773
        };
        const critical01custom = {
            1: 2.706, 2: 4.605, 3: 6.251, 4: 7.779, 5: 9.236,
            6: 10.645, 7: 12.017, 8: 13.362, 9: 14.684, 10: 15.987,
            12: 18.549, 15: 22.307, 20: 28.412, 30: 40.256
        };

        const c001 = critical001[df];
        const c01 = critical01[df];
        const c005 = critical005[df];
        const c01custom = critical01custom[df];

        if (c001 && chiSquare >= c001) return "<= 0.001";
        if (c01 && chiSquare >= c01) return "<= 0.01";
        if (c005 && chiSquare >= c005) return `<= 0.05`;
        if (c01custom && chiSquare >= c01custom) return `<= 0.10`;

        // For df not in table, use approximation
        if (c001) return `> ${alpha}`;  // df is in table but chiSquare below threshold

        // Approximation for larger df using same logic as isSignificant
        const critical = df + 2 * Math.sqrt(df);
        if (chiSquare >= critical + 5) return "<= 0.01";
        if (chiSquare >= critical) return `<= 0.05`;
        return `> ${alpha}`;
    }

    /**
     * Get case IDs for a specific cell
     */
    getCellCases(crosstabResult, rowValue, colValue) {
        const key = `${rowValue},${colValue}`;
        return crosstabResult.cellCases[key] || [];
    }

    /**
     * Merge row categories (for interactive merging feature)
     * @param {array} crosstabResult - Original crosstab result
     * @param {object} mergeMap - Map of which rows to merge together
     *                          e.g., { 1: 'A', 2: 'A', 3: 'B' }
     */
    mergeRows(crosstabResult, mergeMap) {
        // Group row values by merge group
        const mergeGroups = {};
        for (const rv of crosstabResult.rowValues) {
            const group = mergeMap[rv] || rv;
            if (!mergeGroups[group]) {
                mergeGroups[group] = [];
            }
            mergeGroups[group].push(rv);
        }

        // Create new merged row values
        const newRowValues = Object.keys(mergeGroups).map(k => isNaN(k) ? k : parseInt(k));
        newRowValues.sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
            return a - b;
        });

        // Initialize new cell counts
        const newCellCounts = {};
        const newCellCases = {};
        const newRowTotals = {};

        for (const group of newRowValues) {
            newRowTotals[group] = 0;
            for (const cv of crosstabResult.colValues) {
                const key = `${group},${cv}`;
                newCellCounts[key] = 0;
                newCellCases[key] = [];
            }
        }

        // Aggregate counts
        for (const [group, rowVals] of Object.entries(mergeGroups)) {
            for (const rv of rowVals) {
                for (const cv of crosstabResult.colValues) {
                    const oldKey = `${rv},${cv}`;
                    const newKey = `${group},${cv}`;

                    newCellCounts[newKey] += crosstabResult.cellCounts[oldKey] || 0;
                    newCellCases[newKey] = [
                        ...newCellCases[newKey],
                        ...(crosstabResult.cellCases[oldKey] || [])
                    ];
                }
                newRowTotals[group] += crosstabResult.rowTotals[rv] || 0;
            }
        }

        return {
            ...crosstabResult,
            rowValues: newRowValues,
            cellCounts: newCellCounts,
            cellCases: newCellCases,
            rowTotals: newRowTotals,
            rowMergeGroups: mergeGroups
        };
    }

    /**
     * Merge column categories (for interactive merging feature)
     */
    mergeCols(crosstabResult, mergeMap) {
        // Group column values by merge group
        const mergeGroups = {};
        for (const cv of crosstabResult.colValues) {
            const group = mergeMap[cv] || cv;
            if (!mergeGroups[group]) {
                mergeGroups[group] = [];
            }
            mergeGroups[group].push(cv);
        }

        // Create new merged column values
        const newColValues = Object.keys(mergeGroups).map(k => isNaN(k) ? k : parseInt(k));
        newColValues.sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
            return a - b;
        });

        // Initialize new cell counts
        const newCellCounts = {};
        const newCellCases = {};
        const newColTotals = {};

        for (const rv of crosstabResult.rowValues) {
            for (const group of newColValues) {
                const key = `${rv},${group}`;
                newCellCounts[key] = 0;
                newCellCases[key] = [];
            }
        }

        for (const group of newColValues) {
            newColTotals[group] = 0;
        }

        // Aggregate counts
        for (const [group, colVals] of Object.entries(mergeGroups)) {
            for (const cv of colVals) {
                for (const rv of crosstabResult.rowValues) {
                    const oldKey = `${rv},${cv}`;
                    const newKey = `${rv},${group}`;

                    newCellCounts[newKey] += crosstabResult.cellCounts[oldKey] || 0;
                    newCellCases[newKey] = [
                        ...newCellCases[newKey],
                        ...(crosstabResult.cellCases[oldKey] || [])
                    ];
                }
                newColTotals[group] += crosstabResult.colTotals[cv] || 0;
            }
        }

        return {
            ...crosstabResult,
            colValues: newColValues,
            cellCounts: newCellCounts,
            cellCases: newCellCases,
            colTotals: newColTotals,
            colMergeGroups: mergeGroups
        };
    }
}

export default CrosstabEngine;
