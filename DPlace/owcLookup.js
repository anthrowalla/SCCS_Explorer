/**
 * OWC Society Lookup Module
 * Loads society information from owc_info.json
 */

export class OwcLookup {
    constructor() {
        this.societies = {}; // caseID -> society data
    }

    /**
     * Parse owc_info.json format
     * Each entry has sccs_group (case ID), sccs, term, description, year, latitude, longitude, etc.
     */
    parseOwcInfo(owcData) {
        this.societies = {};

        for (const entry of owcData.data) {
            const caseId = parseInt(entry.sccs_group, 10);
            if (!isNaN(caseId)) {
                this.societies[caseId] = {
                    id: entry.id,
                    name: entry.sccs,
                    term: entry.term,
                    year: entry.year,
                    latitude: entry.latitude,
                    longitude: entry.longitude,
                    description: entry.description,
                    highest_bt: entry.highest_bt,
                    bt: entry.bt,
                    subsistence_type: entry.subsistence_type,
                    docs: entry.docs,
                    hasSummary: entry.hasSummary
                };
            }
        }

        return this.societies;
    }

    /**
     * Load and parse owc_info.json
     */
    async loadOwcInfo(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load owc_info.json: ${response.statusText}`);
            }
            const owcData = await response.json();
            return this.parseOwcInfo(owcData);
        } catch (error) {
            console.error('Error loading owc_info.json:', error);
            throw error;
        }
    }

    /**
     * Get society information by case ID (SCCS group number)
     */
    getSociety(caseId) {
        return this.societies[caseId] || {
            name: `Society ${caseId}`,
            term: '',
            year: '',
            latitude: '',
            longitude: '',
            description: '',
            highest_bt: '',
            bt: '',
            subsistence_type: '',
            docs: 0
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
}

export default OwcLookup;
