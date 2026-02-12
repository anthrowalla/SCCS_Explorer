/**
 * Society Lookup Module
 * Parses the .glbl file to get society names and metadata
 */

export class SocietyLookup {
    constructor() {
        this.societies = {}; // caseID -> {name, year, area, ...}
    }

    /**
     * Parse the .glbl file format
     * Format: tab-separated
     * ID	Name	Year	Area	...
     */
    parseSocieties(glblText) {
        const lines = glblText.split('\n');

        for (let line of lines) {
            // Skip AWK wrapper lines and empty lines
            if (!line.trim() ||
                line.includes('exec nawk') ||
                line.includes('<<EOF') ||
                line.trim() === 'EOF' ||
                line.includes("'")) {
                continue;
            }

            // Split by tab
            const fields = line.split('\t');
            if (fields.length < 3) continue;

            const caseId = parseInt(fields[0], 10);
            const name = fields[1];
            const year = fields[2];

            if (!isNaN(caseId)) {
                this.societies[caseId] = {
                    name: name || `Society ${caseId}`,
                    year: year || '',
                    area: fields[3] || '',
                    classification: fields[4] || ''
                };
            }
        }

        return this.societies;
    }

    /**
     * Load and parse the .glbl file
     */
    async loadSocieties(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load society lookup file: ${response.statusText}`);
            }
            const text = await response.text();
            return this.parseSocieties(text);
        } catch (error) {
            console.error('Error loading societies:', error);
            throw error;
        }
    }

    /**
     * Get society information by case ID
     */
    getSociety(caseId) {
        return this.societies[caseId] || {
            name: `Society ${caseId}`,
            year: '',
            area: '',
            classification: ''
        };
    }

    /**
     * Get multiple societies by case IDs
     */
    getSocieties(caseIds) {
        return caseIds.map(id => this.getSociety(id));
    }

    /**
     * Get society name
     */
    getSocietyName(caseId) {
        const society = this.getSociety(caseId);
        return society.name;
    }

    /**
     * Load cases from already-loaded text (for app.js that fetches separately)
     */
    loadCasesFromText(casesText) {
        const lines = casesText.split('\n');
        const socs = {};
        let dataStarted = false;

        for (let line of lines) {
            // Detect start of data (when we see "1 " pattern)
            if (line.match(/^\s*1\s+/)) {
                dataStarted = true;
            }
            if (!dataStarted) continue;
            if (!line.trim()) continue;

            // Parse: No. Society (SCCS)  Date  E.A. Area Focus  Description
            const match = line.match(/^\s*(\d+)\s+(.+?)\s+(\d{4})\s+([A-Za-z]\d+)\s+(.+?)\s*$/);
            if (match) {
                const caseId = parseInt(match[1]);
                socs[caseId] = {
                    name: match[2].trim(),
                    year: match[3],
                    areaCode: match[4],
                    description: match[5].trim()
                };
            }
        }
        // Merge with existing societies
        this.societies = { ...this.societies, ...socs };
    }
}

export default SocietyLookup;
