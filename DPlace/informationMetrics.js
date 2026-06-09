/**
 * Information Theory Metrics Module
 * Calculates Shannon entropy and mutual information for contingency tables
 */

export class InformationMetrics {
    /**
     * Safe log2 function that returns 0 for probability 0
     * @param {number} x - The value to take log of
     * @returns {number} log2(x) or 0 if x <= 0
     */
    safeLog2(x) {
        if (x <= 0 || isNaN(x)) return 0;
        return Math.log2(x);
    }

    /**
     * Calculate information metrics for a crosstab
     * @param {object} crosstabResult - The crosstab result from crosstabEngine
     * @returns {object} Metrics including H(R), H(C), H(R,C), I(R;C), and cell interactions
     */
    calculateMetrics(crosstabResult) {
        const { cellCounts, rowValues, colValues, rowTotals, colTotals, grandTotal } = crosstabResult;

        // If grand total is 0, return all zeros
        if (!grandTotal || grandTotal <= 0) {
            return {
                rowEntropy: 0,
                colEntropy: 0,
                jointEntropy: 0,
                mutualInformation: 0,
                cellInteractions: {},
                rowValues,
                colValues
            };
        }

        // Build probability matrix
        const probMatrix = {};
        for (const rv of rowValues) {
            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                const count = cellCounts[key] || 0;
                probMatrix[key] = count / grandTotal;
            }
        }

        // Calculate marginal probabilities
        const rowMarginals = {};
        for (const rv of rowValues) {
            rowMarginals[rv] = (rowTotals[rv] || 0) / grandTotal;
        }

        const colMarginals = {};
        for (const cv of colValues) {
            colMarginals[cv] = (colTotals[cv] || 0) / grandTotal;
        }

        // Calculate Row Entropy H(R)
        let rowEntropy = 0;
        for (const rv of rowValues) {
            const p = rowMarginals[rv];
            rowEntropy -= p * this.safeLog2(p);
        }

        // Calculate Column Entropy H(C)
        let colEntropy = 0;
        for (const cv of colValues) {
            const p = colMarginals[cv];
            colEntropy -= p * this.safeLog2(p);
        }

        // Calculate Joint Entropy H(R,C)
        let jointEntropy = 0;
        for (const rv of rowValues) {
            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                const p = probMatrix[key] || 0;
                jointEntropy -= p * this.safeLog2(p);
            }
        }

        // Calculate Mutual Information I(R;C) = H(R) + H(C) - H(R,C)
        const mutualInformation = rowEntropy + colEntropy - jointEntropy;

        // Calculate cell-wise interaction contributions (weighted PMI)
        // and cell-wise joint entropy contributions
        const cellInteractions = {};
        const cellJointContributions = {};
        for (const rv of rowValues) {
            for (const cv of colValues) {
                const key = `${rv},${cv}`;
                const pij = probMatrix[key] || 0;
                const pi = rowMarginals[rv] || 0;
                const pj = colMarginals[cv] || 0;

                // I_ij = p_ij * log2(p_ij / (p_i * p_j))
                let interaction = 0;
                if (pij > 0 && pi > 0 && pj > 0) {
                    interaction = pij * Math.log2(pij / (pi * pj));
                }
                cellInteractions[key] = interaction;

                // H_ij = -p_ij * log2(p_ij) - joint entropy contribution for this cell
                cellJointContributions[key] = -pij * this.safeLog2(pij);
            }
        }

        // Calculate row-wise entropy contributions (for display in table)
        const rowEntropyContributions = {};
        for (const rv of rowValues) {
            const p = rowMarginals[rv] || 0;
            rowEntropyContributions[rv] = -p * this.safeLog2(p);
        }

        // Calculate column-wise entropy contributions (for display in table)
        const colEntropyContributions = {};
        for (const cv of colValues) {
            const p = colMarginals[cv] || 0;
            colEntropyContributions[cv] = -p * this.safeLog2(p);
        }

        return {
            rowEntropy,
            colEntropy,
            jointEntropy,
            mutualInformation,
            cellInteractions,
            cellJointContributions,
            rowEntropyContributions,
            colEntropyContributions,
            rowValues,
            colValues
        };
    }

    /**
     * Get a string representation of a metric value rounded to 3 decimal places
     * @param {number} value - The metric value
     * @returns {string} Formatted string
     */
    formatValue(value) {
        if (isNaN(value) || !isFinite(value)) return '0.000';
        return value.toFixed(3);
    }
}

export default InformationMetrics;
