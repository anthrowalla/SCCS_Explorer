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
     * @returns {object} Crosstabulation result
     */
    crosstab(rowVar, colVar) {
        const data = this.dataParser.getAllData();
        const rowColIndex = rowVar - 1;
        const colColIndex = colVar - 1;

        // Get unique values for each variable
        const rowValues = this.dataParser.getUniqueValues(rowVar).filter(v => v !== null);
        const colValues = this.dataParser.getUniqueValues(colVar).filter(v => v !== null);

        // Sort values numerically
        rowValues.sort((a, b) => a - b);
        colValues.sort((a, b) => a - b);

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

            // Skip cases with missing data
            if (rv === null || cv === null) continue;

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
    calculateStatistics(crosstabResult) {
        const { cellCounts, rowTotals, colTotals, grandTotal } = crosstabResult;

        const expected = {};
        const observedMinusExpected = {};
        const chiSquareContributions = {};
        let totalChiSquare = 0;

        for (const [key, observed] of Object.entries(cellCounts)) {
            const [rv, cv] = key.split(',').map(Number);

            // Expected value = (row_total * col_total) / grand_total
            const expectedVal = (rowTotals[rv] * colTotals[cv]) / grandTotal;
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

        // Determine significance (using chi-square table for p < 0.05)
        const isSignificant = this.isSignificant(totalChiSquare, degreesOfFreedom);

        return {
            expected,
            observedMinusExpected,
            chiSquareContributions,
            totalChiSquare,
            degreesOfFreedom,
            isSignificant,
            pValue: this.estimatePValue(totalChiSquare, degreesOfFreedom)
        };
    }

    /**
     * Check if chi-square is significant at p < 0.05 level
     * Critical values from chi-square distribution table
     */
    isSignificant(chiSquare, df) {
        const criticalValues = {
            1: 3.841,
            2: 5.991,
            3: 7.815,
            4: 9.488,
            5: 11.070,
            6: 12.592,
            7: 14.067,
            8: 15.507,
            9: 16.919,
            10: 18.307,
            12: 21.026,
            15: 24.996,
            20: 31.410,
            30: 43.773
        };

        // For df values not in table, interpolate or use approximation
        const critical = criticalValues[df];
        if (critical) {
            return chiSquare > critical;
        }

        // Approximation: chiSquare > df + 2*sqrt(df) for large df
        return chiSquare > df + 2 * Math.sqrt(df);
    }

    /**
     * Estimate p-value (simplified approximation)
     */
    estimatePValue(chiSquare, df) {
        // This is a simplified approximation
        // For accurate p-values, you'd need a statistical library
        if (df === 1) {
            if (chiSquare > 10.828) return "< 0.001";
            if (chiSquare > 6.635) return "< 0.01";
            if (chiSquare > 3.841) return "< 0.05";
            return "> 0.05";
        } else if (df === 2) {
            if (chiSquare > 13.816) return "< 0.001";
            if (chiSquare > 9.210) return "< 0.01";
            if (chiSquare > 5.991) return "< 0.05";
            return "> 0.05";
        } else {
            if (chiSquare > df * 2) return "< 0.01";
            if (chiSquare > df * 1.5) return "< 0.05";
            return "> 0.05";
        }
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
            rowTotals: newRowTotals
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
            colTotals: newColTotals
        };
    }
}

export default CrosstabEngine;
