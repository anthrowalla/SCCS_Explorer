/**
 * Data Loader Utility
 * Converts EthnoAtlas data files to JSON format for embedding
 * Run this in Node.js to generate the JSON data file
 *
 * Usage: node dataLoader.js
 */

import fs from 'fs';

// Read the data files
const dataFile = fs.readFileSync('../EthnoAtlas.data', 'utf-8');
const lblFile = fs.readFileSync('../EthnoAtlas.lbl', 'utf-8');
const glblFile = fs.readFileSync('../EthnoAtlas.glbl', 'utf-8');

// Parse data file
function parseData(dataText) {
    const lines = dataText.trim().split('\n');
    const data = [];

    for (const line of lines) {
        if (!line.trim()) continue;
        const values = line.trim().split(/\s+/);
        const parsedValues = values.map(v => {
            if (v === '.') return null;
            const num = parseInt(v, 10);
            return isNaN(num) ? v : num;
        });
        data.push(parsedValues);
    }

    return data;
}

// Parse label file
function parseLabels(lblText) {
    const lines = lblText.split('\n');
    const variableLabels = {};
    const valueLabels = {};
    let currentVar = null;
    let inData = false;

    for (let line of lines) {
        if (line.includes('<<EOF')) {
            inData = true;
            continue;
        }
        if (!inData) continue;
        if (line.trim() === 'EOF' || line.trim() === "' EOF") continue;

        const varMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (varMatch) {
            currentVar = parseInt(varMatch[1], 10);
            variableLabels[currentVar] = varMatch[2].trim();
            continue;
        }

        if (inData && currentVar !== null) {
            const trimmed = line.trim();
            if (trimmed === '') {
                currentVar = null;
                continue;
            }

            const valueMatch = trimmed.match(/^([.\d]+)\s+(.+)$/);
            if (valueMatch) {
                const valueCode = valueMatch[1];
                const labelText = valueMatch[2].trim();
                const key = `${currentVar},${valueCode}`;
                valueLabels[key] = labelText;
            }
        }
    }

    return { variableLabels, valueLabels };
}

// Parse society file
function parseSocieties(glblText) {
    const lines = glblText.split('\n');
    const societies = {};

    for (let line of lines) {
        if (!line.trim() ||
            line.includes('exec nawk') ||
            line.includes('<<EOF') ||
            line.trim() === 'EOF' ||
            line.includes("'")) continue;

        const fields = line.split('\t');
        if (fields.length < 3) continue;

        const caseId = parseInt(fields[0], 10);
        if (!isNaN(caseId)) {
            societies[caseId] = {
                name: fields[1] || `Society ${caseId}`,
                year: fields[2] || '',
                area: fields[3] || '',
                classification: fields[4] || ''
            };
        }
    }

    return societies;
}

// Generate JSON
const data = parseData(dataFile);
const labels = parseLabels(lblFile);
const societies = parseSocieties(glblFile);

const output = {
    data,
    labels,
    societies,
    metadata: {
        caseCount: data.length,
        variableCount: data.length > 0 ? data[0].length : 0,
        generatedAt: new Date().toISOString()
    }
};

// Write to file
fs.writeFileSync('ethnoAtlasData.json', JSON.stringify(output, null, 2));

console.log(`Generated ethnoAtlasData.json:`);
console.log(`  ${data.length} societies`);
console.log(`  ${data.length > 0 ? data[0].length : 0} variables`);
console.log(`  File size: ${(JSON.stringify(output).length / 1024).toFixed(2)} KB`);
