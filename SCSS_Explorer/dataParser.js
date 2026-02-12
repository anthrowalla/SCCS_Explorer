/**
 * Data Parser Module
 * Parses the fixed-width EthnoAtlas.data format
 */

export class DataParser {
    constructor() {
        this.data = [];
        this.variables = [];
    }

    /**
     * Parse the fixed-width data format from EthnoAtlas.data
     * Format: space-separated values with missing data as '.'
     */
    parseData(dataText) {
        const lines = dataText.trim().split('\n');
        const data = [];

        for (const line of lines) {
            // Skip empty lines
            if (!line.trim()) continue;

            // Split by whitespace
            const values = line.trim().split(/\s+/);

            // Parse each value, handling missing data (.)
            const parsedValues = values.map(v => {
                if (v === '.') return null;
                const num = parseInt(v, 10);
                return isNaN(num) ? v : num;
            });

            data.push(parsedValues);
        }

        this.data = data;
        return data;
    }

    /**
     * Load and parse the EthnoAtlas.data file
     */
    async loadData(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load data file: ${response.statusText}`);
            }
            const text = await response.text();
            return this.parseData(text);
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    /**
     * Get the number of cases (societies)
     */
    getCaseCount() {
        return this.data.length;
    }

    /**
     * Get the number of variables
     */
    getVariableCount() {
        return this.data.length > 0 ? this.data[0].length : 0;
    }

    /**
     * Get values for a specific variable (column)
     * Variable numbers are 1-indexed in the original system
     */
    getVariableValues(varNum) {
        const colIndex = varNum - 1; // Convert to 0-indexed
        return this.data.map(row => row[colIndex]);
    }

    /**
     * Get all data for a specific case (society)
     */
    getCaseData(caseIndex) {
        return this.data[caseIndex];
    }

    /**
     * Get all data
     */
    getAllData() {
        return this.data;
    }

    /**
     * Count frequency of each unique value in a variable
     */
    getValueFrequencies(varNum) {
        const values = this.getVariableValues(varNum);
        const frequencies = {};

        for (const val of values) {
            const key = val === null ? 'missing' : val;
            frequencies[key] = (frequencies[key] || 0) + 1;
        }

        return frequencies;
    }

    /**
     * Get unique values for a variable
     */
    getUniqueValues(varNum) {
        const values = this.getVariableValues(varNum);
        const uniqueSet = new Set();

        for (const val of values) {
            uniqueSet.add(val);
        }

        return Array.from(uniqueSet).sort((a, b) => {
            if (a === null) return -1;
            if (b === null) return 1;
            return a - b;
        });
    }

    /**
     * Filter cases based on variable value criteria
     */
    filterCases(criteria) {
        // criteria: { varNum: value }
        return this.data.filter((row, index) => {
            for (const [varNum, expectedValue] of Object.entries(criteria)) {
                const colIndex = parseInt(varNum, 10) - 1;
                const actualValue = row[colIndex];

                if (expectedValue === null) {
                    if (actualValue !== null) return false;
                } else {
                    if (actualValue !== expectedValue) return false;
                }
            }
            return true;
        });
    }

    /**
     * Get case IDs for a specific cell (rowVarValue, colVarValue)
     */
    getCaseIDsForCell(rowVar, colVar, rowVarValue, colVarValue) {
        const rowColIndex = rowVar - 1;
        const colColIndex = colVar - 1;

        return this.data
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => {
                const rowVal = row[rowColIndex];
                const colVal = row[colColIndex];
                return rowVal === rowVarValue && colVal === colVarValue;
            })
            .map(({ index }) => index + 1); // Return 1-indexed case IDs
    }
}

export default DataParser;
