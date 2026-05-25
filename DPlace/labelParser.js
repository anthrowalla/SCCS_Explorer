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
        this.varCategories = {};        // varNum -> category string
        this.varTypes = {};             // varNum -> type string (Categorical/Ordinal)
        this.varDefinitions = {};       // varNum -> description text
        this.varCitations = {};         // varNum -> bibliographic citation
        this.varSources = {};           // varNum -> source citation code
        this.varSccsNums = {};          // varNum (sequential) -> original SCCS number
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
     * Returns an array of {number, name, sccsNum} objects
     */
    getAllVariables() {
        const variables = [];

        for (const [num, name] of Object.entries(this.variableLabels)) {
            variables.push({
                number: parseInt(num, 10),
                name: name,
                sccsNum: this.varSccsNums[num] || num
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

    /**
     * Load and parse SCCS.varinfo — tab-separated variable metadata
     */
    async loadVarInfo(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load varinfo file: ${response.statusText}`);
            }
            const text = await response.text();
            return this.parseVarInfo(text);
        } catch (error) {
            console.error('Error loading varinfo:', error);
            throw error;
        }
    }

    /**
     * Parse tab-separated varinfo text
     */
    parseVarInfo(text) {
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parts = trimmed.split('\t');
            if (parts.length >= 4) {
                const num = parseInt(parts[0], 10);
                this.varSccsNums[num] = parts[1];
                this.varCategories[num] = parts[2];
                this.varTypes[num] = parts[4];
                this.varDefinitions[num] = parts[5] || '';
                this.varCitations[num] = parts[6] || '';
                this.varSources[num] = parts[7] || '';
            }
        }
        return {
            varCategories: this.varCategories,
            varTypes: this.varTypes,
            varDefinitions: this.varDefinitions,
            varCitations: this.varCitations,
            varSources: this.varSources,
            varSccsNums: this.varSccsNums
        };
    }

    /**
     * Get the category for a variable
     */
    getCategory(varNum) {
        return this.varCategories[varNum] || '';
    }

    /**
     * Get the type for a variable (Categorical/Ordinal)
     */
    getType(varNum) {
        return this.varTypes[varNum] || '';
    }

    /**
     * Get the definition snippet for a variable
     */
    getDefinition(varNum) {
        return this.varDefinitions[varNum] || '';
    }

    /**
     * Get sorted list of unique categories
     */
    getCategories() {
        const cats = new Set(Object.values(this.varCategories));
        return [...cats].filter(c => c).sort();
    }

    /**
     * Get the original SCCS number for a variable (e.g. 860 for column 860)
     */
    getSccsNum(varNum) {
        return this.varSccsNums[varNum] || String(varNum);
    }

    /**
     * Get the bibliographic citation for a variable
     */
    getCitation(varNum) {
        return this.varCitations[varNum] || '';
    }

    /**
     * Get the source citation code for a variable
     */
    getSource(varNum) {
        return this.varSources[varNum] || '';
    }
}

export default LabelParser;
