/**
 * OWC Society Lookup Module
 * Loads society information from owc_info_unified.json (unified registry)
 * Supports cross-dataset society lookup and HRAF information
 */

export class OwcLookup {
    constructor() {
        this.groups = {};        // group_id -> {hraf_name, hraf_summary, region, societies[]}
        this.societies = {};     // soc_id -> group data
        this.caseIndex = {};    // case_id -> society data (for SCCS)
        this.eaCaseIndex = {};   // sequential case number -> society data (for EA)
        this.currentDataset = ''; // Current active dataset
    }

    /**
     * Parse owc_info_unified.json format
     * Each group has id, hraf_name, hraf_summary, region, societies[]
     */
    parseOwcInfo(owcData) {
        this.groups = {};
        this.societies = {};
        this.caseIndex = {};
        this.eaCaseIndex = {};

        const data = owcData.data || [];

        // Track EA case numbers (sequential)
        let eaCaseNum = 1;

        for (const group of data) {
            const groupId = group.id;

            this.groups[groupId] = {
                id: groupId,
                hraf_name: group.hraf_name || '',
                hraf_summary: group.hraf_summary || '',
                region: group.region || '',
                bt: group.bt || '',
                subsistence_type: group.subsistence_type || '',
                docs: group.docs || 0,
                hasSummary: group.hasSummary || false,
                from_ea_only: group.from_ea_only || false,
                societies: []
            };

            // Index societies
            for (const society of (group.societies || [])) {
                const socId = society.soc_id;
                const dataset = society.dataset;

                this.groups[groupId].societies.push(society);

                // Create society lookup
                this.societies[socId] = {
                    ...society,
                    group_id: groupId,
                    hraf_name: group.hraf_name || '',
                    hraf_summary: group.hraf_summary || '',
                    region: group.region || '',
                    bt: group.bt || '',
                    subsistence_type: group.subsistence_type || '',
                    docs: group.docs || 0,
                    hasSummary: group.hasSummary || false
                };

                // Index SCCS by case_id for backward compatibility
                if (dataset === 'SCCS' && society.case_id) {
                    this.caseIndex[society.case_id] = this.societies[socId];
                }

                // Index EA by sequential case number
                if (dataset === 'EA') {
                    this.eaCaseIndex[eaCaseNum] = this.societies[socId];
                    eaCaseNum++;
                }
            }
        }

        console.log(`Loaded ${Object.keys(this.groups).length} groups, ${Object.keys(this.societies).length} societies`);
        console.log(`  SCCS cases: ${Object.keys(this.caseIndex).length}, EA cases: ${Object.keys(this.eaCaseIndex).length}`);
        return this.groups;
    }

    /**
     * Load and parse owc_info_unified.json
     */
    async loadOwcInfo(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load owc_info_unified.json: ${response.statusText}`);
            }
            const owcData = await response.json();
            return this.parseOwcInfo(owcData);
        } catch (error) {
            console.error('Error loading owc_info_unified.json:', error);
            throw error;
        }
    }

    /**
     * Get society information by society ID (e.g., 'SCCS1', 'Aa3')
     */
    getSociety(socId) {
        return this.societies[socId] || {
            soc_id: socId,
            dataset: 'Unknown',
            pref_name: socId,
            group_id: '',
            hraf_name: '',
            hraf_summary: '',
            region: ''
        };
    }

    /**
     * Set the current dataset (for proper case ID lookups)
     */
    setCurrentDataset(dataset) {
        this.currentDataset = dataset;
    }

    /**
     * Get society information by case number (works for both SCCS and EA)
     */
    getSocietyByCaseId(caseId) {
        // Convert caseId to number for indexing
        const caseNum = parseInt(caseId, 10);
        if (isNaN(caseNum)) {
            console.warn(`Invalid case ID: ${caseId}`);
            return this.getFallbackSociety(caseId);
        }

        // Try EA first if current dataset is EA
        if (this.currentDataset === 'ea' && this.eaCaseIndex[caseNum]) {
            return this.eaCaseIndex[caseNum];
        }

        // Try SCCS
        if (this.caseIndex[caseNum]) {
            return this.caseIndex[caseNum];
        }

        // Try EA as fallback
        if (this.eaCaseIndex[caseNum]) {
            return this.eaCaseIndex[caseNum];
        }

        // Fallback for unknown cases
        console.warn(`Society not found for case ID: ${caseId}, current dataset: ${this.currentDataset}`);
        return this.getFallbackSociety(caseNum);
    }

    getFallbackSociety(caseId) {
        const fallbackDataset = this.currentDataset === 'ea' ? 'EA' : 'SCCS';
        return {
            soc_id: `${fallbackDataset}${caseId}`,
            dataset: fallbackDataset,
            pref_name: `Society ${caseId}`,
            case_id: String(caseId),
            group_id: '',
            hraf_name: '',
            hraf_summary: '',
            region: '',
            bt: '',
            subsistence_type: '',
            docs: 0,
            hasSummary: false,
            alt_names: []
        };
    }

    /**
     * Get multiple societies by society IDs
     */
    getSocieties(socIds) {
        return socIds.map(id => this.getSociety(id));
    }

    /**
     * Get society name
     */
    getSocietyName(socId) {
        const society = this.getSociety(socId);
        return society.pref_name || socId;
    }

    /**
     * Get all societies in a group (cross-dataset)
     */
    getGroupSocieties(groupId) {
        const group = this.groups[groupId];
        if (!group) return [];

        return group.societies;
    }

    /**
     * Get HRAF information for a society
     */
    getHrafInfo(socId) {
        const society = this.getSociety(socId);
        return {
            name: society.hraf_name,
            summary: society.hraf_summary,
            region: society.region,
            group_id: society.group_id
        };
    }

    /**
     * Get cross-dataset references for a society
     * Returns other societies in the same group (e.g., EA equivalent of SCCS society)
     */
    getCrossDatasetRefs(socId) {
        const society = this.getSociety(socId);
        if (!society.group_id) return [];

        const group = this.groups[society.group_id];
        if (!group) return [];

        // Return other societies in the same group, excluding the current one
        return group.societies.filter(s => s.soc_id !== socId);
    }

    /**
     * Get external link for a society
     * Returns appropriate link based on dataset and available data
     */
    getExternalLink(socId) {
        const society = this.getSociety(socId);
        const links = [];

        // D-Place link based on dataset
        if (society.dataset === 'SCCS' && society.case_id) {
            links.push({
                type: 'D-PLACE',
                url: `https://d-place.org/society/SCCS${society.case_id}`,
                label: 'View in D-PLACE'
            });
        } else if (society.dataset === 'EA' && society.soc_id) {
            links.push({
                type: 'D-PLACE',
                url: `https://d-place.org/society/${society.soc_id}`,
                label: 'View in D-PLACE'
            });
        }

        // eHRAF link (if HRAF OWC is available)
        if (society.group_id) {
            const owc = society.group_id.toUpperCase();
            links.push({
                type: 'eHRAF',
                url: `https://ehrafworldcultures.yale.edu/collection?owc=${owc}`,
                label: `View in eHRAF (${owc})`
            });
        }

        return links;
    }
}

export default OwcLookup;
