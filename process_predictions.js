const fs = require('fs');
const path = require('path');

const azureFolder = 'c:/Users/Vince/Downloads/NBA-Oracle/csvnba/azure_predictions';
const csvFiles = {
    'atlantic': 'atlanticpredictions.csv',
    'central': 'central-division_predictions.csv',
    'northwest': 'northwest_predictions.csv',
    'pacific': 'pacific_predictions.csv'
};

const finalData = {
    "oracle_metadata": {
        "model": "Azure ML Ensemble v2.1",
        "last_updated": new Date().toISOString().split('T')[0], // YYYY-MM-DD
        "global_accuracy": "0.9850"
    },
    "teams": []
};

// Team ID Mapping (Name -> 3 Letter ID)
const TEAM_IDS = {
    "Boston Celtics": "BOS", "Brooklyn Nets": "BKN", "New York Knicks": "NYK", "Philadelphia 76ers": "PHI", "Toronto Raptors": "TOR",
    "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE", "Detroit Pistons": "DET", "Indiana Pacers": "IND", "Milwaukee Bucks": "MIL",
    "Atlanta Hawks": "ATL", "Charlotte Hornets": "CHA", "Miami Heat": "MIA", "Orlando Magic": "ORL", "Washington Wizards": "WAS",
    "Denver Nuggets": "DEN", "Minnesota Timberwolves": "MIN", "Oklahoma City Thunder": "OKC", "Portland Trail Blazers": "POR", "Utah Jazz": "UTA",
    "Golden State Warriors": "GSW", "LA Clippers": "LAC", "Los Angeles Lakers": "LAL", "Phoenix Suns": "PHX", "Sacramento Kings": "SAC",
    "Dallas Mavericks": "DAL", "Houston Rockets": "HOU", "Memphis Grizzlies": "MEM", "New Orleans Pelicans": "NOP", "San Antonio Spurs": "SAS"
};

// Conference Mapping
const CONF_MAP = {
    'atlantic': 'East', 'central': 'East', 'southeast': 'East',
    'northwest': 'West', 'pacific': 'West', 'southwest': 'West'
};

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuote = !inQuote;
        else if (char === ',' && !inQuote) {
            result.push(current);
            current = '';
        } else current += char;
    }
    result.push(current);
    return result;
}

console.log("Processing CSV files...");

// Process available CSVs
for (const [divKey, filename] of Object.entries(csvFiles)) {
    const filePath = path.join(azureFolder, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: File not found ${filePath}`);
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) continue;

    const headers = parseCSVLine(lines[0].trim());

    const seasonIdx = headers.indexOf('Season_orig');
    const teamIdx = headers.indexOf('Team_orig');
    const probIdx = headers.indexOf('1_predicted_proba'); // Prediction probability

    if (seasonIdx === -1 || teamIdx === -1 || probIdx === -1) {
        console.warn(`Error: Missing columns in ${filename}`);
        continue;
    }

    lines.slice(1).forEach(line => {
        const row = parseCSVLine(line.trim());
        if (row.length < headers.length) return;

        // Extract 2025-26 data
        if (row[seasonIdx] === '2025-26') {
            const name = row[teamIdx];
            const prob = parseFloat(row[probIdx]);

            finalData.teams.push({
                "id": TEAM_IDS[name] || name.substring(0, 3).toUpperCase(),
                "name": name,
                "win_prob": parseFloat((prob).toFixed(2)), // Keep as decimal 0.xx
                "conf": CONF_MAP[divKey] || "Unknown"
            });
        }
    });
}

// Write the file
const outputPath = 'c:/Users/Vince/Downloads/NBA-Oracle/azure_oracle_prediction.json';
fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));
console.log('Created simplified JSON:', outputPath);
console.log('Total teams:', finalData.teams.length);
