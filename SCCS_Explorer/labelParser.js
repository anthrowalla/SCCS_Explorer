/**
 * Label Parser Module
 * Parses the .lbl script format to extract variable names and value labels
 * Format: AWK script with embedded heredoc containing variable definitions
 */

export class LabelParser {
    constructor() {
        this.variableLabels = {};      // varNum -> variable name
        this.valueLabels = {};          // "varNum,valueCode" -> label text
        this.variableDescriptions = {}; // varNum -> full description
    }

    /**
     * Parse the .lbl file format
     * The format is an AWK script with a heredoc containing:
     * 1.  VARIABLE NAME
     *    1  Value label
     *    2  Value label
     */
    parseLabels(labelText) {
        const lines = labelText.split('\n');
        let currentVar = null;
        let inDefinition = false;

        for (let line of lines) {
            // Skip the AWK wrapper lines (before EOF)
            if (line.includes('<<EOF') || line.includes('exec nawk') || line.includes("'")) {
                continue;
            }

            // Skip EOF marker
            if (line.trim() === 'EOF' || line.trim() === "' EOF") {
                continue;
            }

            // Check if this is a variable definition line (starts with number and period)
            const varMatch = line.match(/^(\d+)\.\s+(.+)$/);
            if (varMatch) {
                currentVar = parseInt(varMatch[1], 10);
                const varName = varMatch[2].trim();
                this.variableLabels[currentVar] = varName;
                this.variableDescriptions[currentVar] = varName;
                inDefinition = true;
                continue;
            }

            // Check if this is a value label line (indented with spaces/tabs, starts with number or .)
            if (inDefinition && currentVar !== null) {
                const trimmedLine = line.trim();

                // Empty line marks end of value definitions
                if (trimmedLine === '') {
                    inDefinition = false;
                    currentVar = null;
                    continue;
                }

                // Value label: "1  Label text" or ".  Missing Data"
                const valueMatch = trimmedLine.match(/^([.\d]+)\s+(.+)$/);
                if (valueMatch) {
                    const valueCode = valueMatch[1];
                    const labelText = valueMatch[2].trim();
                    const key = `${currentVar},${valueCode}`;
                    this.valueLabels[key] = labelText;
                }
            }
        }

        return {
            variableLabels: this.variableLabels,
            valueLabels: this.valueLabels,
            variableDescriptions: this.variableDescriptions
        };
    }

    /**
     * Load and parse the .lbl file
     */
    async loadLabels(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load label file: ${response.statusText}`);
            }
            const text = await response.text();
            return this.parseLabels(text);
        } catch (error) {
            console.error('Error loading labels:', error);
            throw error;
        }
    }

    /**
     * Get the label for a variable
     */
    getVariableLabel(varNum) {
        return this.variableLabels[varNum] || `Variable ${varNum}`;
    }

    /**
     * Get the label for a specific value of a variable
     */
    getValueLabel(varNum, valueCode) {
        const key = `${varNum},${valueCode}`;
        return this.valueLabels[key] || valueCode;
    }

    /**
     * Get all value labels for a variable
     * Returns an array of {code, label} objects sorted by code
     */
    getValueLabelsForVariable(varNum) {
        const labels = [];

        for (const [key, label] of Object.entries(this.valueLabels)) {
            const [vNum, code] = key.split(',');
            if (parseInt(vNum, 10) === varNum) {
                labels.push({ code, label });
            }
        }

        // Sort by code (handle both numeric and string codes)
        labels.sort((a, b) => {
            const aNum = parseFloat(a.code);
            const bNum = parseFloat(b.code);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return aNum - bNum;
            }

            return a.code.localeCompare(b.code);
        });

        return labels;
    }

    /**
     * Get all variable labels
     * Returns an array of {number, name} objects
     */
    getAllVariables() {
        const variables = [];

        for (const [num, name] of Object.entries(this.variableLabels)) {
            variables.push({
                number: parseInt(num, 10),
                name: name
            });
        }

        // Sort by variable number
        variables.sort((a, b) => a.number - b.number);

        return variables;
    }

    /**
     * Get comma-separated value labels for a list of values
     * Equivalent to xlbl function
     */
    getCommaSeparatedLabels(varNum, valueCodes) {
        if (typeof valueCodes === 'string') {
            valueCodes = valueCodes.split(' ');
        }

        return valueCodes
            .map(code => this.getValueLabel(varNum, code))
            .join(', ');
    }

    /**
     * Check if a variable has value labels defined
     */
    hasValueLabels(varNum) {
        for (const key of Object.keys(this.valueLabels)) {
            if (key.startsWith(`${varNum},`)) {
                return true;
            }
        }
        return false;
    }
}

export default LabelParser;
