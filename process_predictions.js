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
    "teams": [],
    "matches": []
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
    const winIdx = headers.indexOf('Win_Pct_orig');

    // NEW: Capture additional stats
    const offRtgIdx = headers.indexOf('Off_Rating_orig');
    const defRtgIdx = headers.indexOf('Def_Rating_orig');

    if (seasonIdx === -1 || teamIdx === -1 || winIdx === -1) {
        console.warn(`Error: Missing columns in ${filename}`);
        continue;
    }

    lines.slice(1).forEach(line => {
        const row = parseCSVLine(line.trim());
        if (row.length < headers.length) return;

        // Extract 2025-26 data
        if (row[seasonIdx] === '2025-26') {
            const name = row[teamIdx];
            const winPct = parseFloat(row[winIdx]);
            const offRtg = offRtgIdx !== -1 ? parseFloat(row[offRtgIdx]) : 0;
            const defRtg = defRtgIdx !== -1 ? parseFloat(row[defRtgIdx]) : 0;

            finalData.teams.push({
                "id": TEAM_IDS[name] || name.substring(0, 3).toUpperCase(),
                "name": name,
                "win_prob": parseFloat((winPct).toFixed(3)),
                "off_rtg": parseFloat(offRtg.toFixed(1)),
                "def_rtg": parseFloat(defRtg.toFixed(1)),
                "conf": CONF_MAP[divKey] || "Unknown"
            });
        }
    });
}

// --- Schedule Integration ---
const schedule = [
    { away: "New York Knicks", home: "Detroit Pistons", time: "7:00 PM" },
    { away: "Washington Wizards", home: "Indiana Pacers", time: "7:00 PM" },
    { away: "Philadelphia 76ers", home: "Atlanta Hawks", time: "7:30 PM" },
    { away: "Boston Celtics", home: "Golden State Warriors", time: "8:00 PM" },
    { away: "Phoenix Suns", home: "San Antonio Spurs", time: "8:00 PM" },
    { away: "Denver Nuggets", home: "LA Clippers", time: "10:30 PM" }
];

finalData.matches = [];

schedule.forEach(game => {
    const awayTeam = finalData.teams.find(t => t.name === game.away);
    const homeTeam = finalData.teams.find(t => t.name === game.home);

    if (awayTeam && homeTeam) {
        // Prediction Logic
        const totalProb = awayTeam.win_prob + homeTeam.win_prob;
        const awayChance = awayTeam.win_prob / totalProb;
        const homeChance = homeTeam.win_prob / totalProb;

        let projectedWinner = awayChance > homeChance ? awayTeam.id : homeTeam.id;
        let winnerObj = awayChance > homeChance ? awayTeam : homeTeam;
        let loserObj = awayChance > homeChance ? homeTeam : awayTeam;

        let confidence = Math.abs(awayChance - homeChance) * 100;

        // --- Reasoning Generation ---
        let factors = [];
        const winDiff = (winnerObj.win_prob - loserObj.win_prob) * 100;

        if (winnerObj.off_rtg > loserObj.off_rtg) {
            const diff = (winnerObj.off_rtg - loserObj.off_rtg).toFixed(1);
            factors.push(`Superior Offense (+${diff} Rtg)`);
        }
        if (winnerObj.def_rtg < loserObj.def_rtg) { // Lower is better for Def Rtg
            const diff = (loserObj.def_rtg - winnerObj.def_rtg).toFixed(1);
            factors.push(`Stronger Defense (-${diff} Rtg)`);
        }
        if (winDiff > 20) {
            factors.push(`Dominant Season Performance`);
        } else if (winDiff < 5) {
            factors.push(`Tight Matchup - Edge via Efficiency`);
        }

        // Pick top reason
        let primaryFactor = factors.length > 0 ? factors[0] : "Overall Win Probability";
        if (factors.length > 1) primaryFactor += ` & ${factors[1]}`;

        finalData.matches.push({
            teams: [awayTeam.name, homeTeam.name],
            ids: [awayTeam.id, homeTeam.id],
            stats: {
                [awayTeam.id]: { off: awayTeam.off_rtg, def: awayTeam.def_rtg },
                [homeTeam.id]: { off: homeTeam.off_rtg, def: homeTeam.def_rtg }
            },
            time: game.time,
            projected_winner: projectedWinner,
            confidence: parseFloat(confidence.toFixed(1)),
            reasoning: primaryFactor
        });
    }
});

// Write the file
const outputPath = 'c:/Users/Vince/Downloads/NBA-Oracle/azure_oracle_prediction.json';
fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2));
console.log('Created simplified JSON with matches & stats:', outputPath);
console.log('Total teams:', finalData.teams.length);
console.log('Total matches:', finalData.matches.length);
