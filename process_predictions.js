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
    "meta": {
        "model": "Azure ML Ensemble v2.1",
        "version": "2.1",
        "last_updated": "2026-02-14",
        "dataset_seasons": ["2016-17", "2017-18", "2018-19", "2019-20", "2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26"],
        "prediction_target": "2025-26"
    },
    "divisions": {}
};

// Helper to parse CSV line properly considering quotes
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function normalize(value, min, max) {
    if (min === max) return 50;
    return ((value - min) / (max - min)) * 100;
}

const allTeamsData = [];

// Determine global min/max
let globalMinOff = Infinity, globalMaxOff = -Infinity;
let globalMinDef = Infinity, globalMaxDef = -Infinity;
let globalMinWin = Infinity, globalMaxWin = -Infinity;

const divisionTeams = {};

// Process each file
for (const [divKey, filename] of Object.entries(csvFiles)) {
    const filePath = path.join(azureFolder, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const headers = parseCSVLine(lines[0].trim());

    // Find numeric indices
    const seasonIdx = headers.indexOf('Season_orig');
    const teamIdx = headers.indexOf('Team_orig');
    const winIdx = headers.indexOf('Win_Pct_orig');
    const offIdx = headers.indexOf('Off_Rating_orig');
    const defIdx = headers.indexOf('Def_Rating_orig');
    const probIdx = headers.indexOf('1_predicted_proba');
    // const madePlayoffsIdx = headers.indexOf('MadePlayoffs_predicted');

    const teams = [];
    const historyByTeam = {};

    // First pass for history
    lines.slice(1).forEach(line => {
        const row = parseCSVLine(line.trim());
        if (row.length < headers.length) return;

        const season = row[seasonIdx];
        const team = row[teamIdx];

        if (season !== '2025-26') {
            if (!historyByTeam[team]) historyByTeam[team] = [];
            historyByTeam[team].push({
                season: season,
                win_pct: parseFloat(row[winIdx]),
                off_rating: parseFloat(row[offIdx]),
                def_rating: parseFloat(row[defIdx]),
                made_playoffs: parseFloat(row[probIdx]) > 0.5 // approximate
            });
        }
    });

    // Second pass for current season
    lines.slice(1).forEach(line => {
        const row = parseCSVLine(line.trim());
        if (row.length < headers.length) return;

        const season = row[seasonIdx];
        if (season === '2025-26') {
            const teamName = row[teamIdx];
            const winPct = parseFloat(row[winIdx]);
            const offRtg = parseFloat(row[offIdx]);
            const defRtg = parseFloat(row[defIdx]);
            const prob = parseFloat(row[probIdx]);

            // Update globals
            if (offRtg < globalMinOff) globalMinOff = offRtg;
            if (offRtg > globalMaxOff) globalMaxOff = offRtg;
            if (defRtg < globalMinDef) globalMinDef = defRtg;
            if (defRtg > globalMaxDef) globalMaxDef = defRtg;
            if (winPct < globalMinWin) globalMinWin = winPct;
            if (winPct > globalMaxWin) globalMaxWin = winPct;

            let status = "eliminated";
            if (prob >= 0.8) status = "clinched";
            else if (prob >= 0.2) status = "contender";

            teams.push({
                team: teamName,
                season: season,
                stats: {
                    win_pct: winPct,
                    off_rating: offRtg,
                    def_rating: defRtg,
                    net_rating: parseFloat((offRtg - defRtg).toFixed(1)),
                    efficiency_pct: winPct * 0.8 // fake
                },
                playoff_status: status,
                historical: historyByTeam[teamName] || [],
                raw_prob: prob
            });
        }
    });

    divisionTeams[divKey] = teams;
}

// Build final structure
for (const [divKey, teams] of Object.entries(divisionTeams)) {
    // Sort
    teams.sort((a, b) => b.raw_prob - a.raw_prob);

    // Analytics
    if (teams.length === 0) continue;

    const strongest = teams[0].team;
    const weakest = teams[teams.length - 1].team;
    const playoffCount = teams.filter(t => t.playoff_status === 'clinched').length;

    const avgOff = teams.reduce((acc, t) => acc + t.stats.off_rating, 0) / teams.length;
    const avgDef = teams.reduce((acc, t) => acc + t.stats.def_rating, 0) / teams.length;
    const avgWin = teams.reduce((acc, t) => acc + t.stats.win_pct, 0) / teams.length;

    const bestOff = teams.reduce((prev, curr) => prev.stats.off_rating > curr.stats.off_rating ? prev : curr).team;
    const bestDef = teams.reduce((prev, curr) => prev.stats.def_rating < curr.stats.def_rating ? prev : curr).team; // Lower is better

    const finalTeams = teams.map(t => {
        const offScore = normalize(t.stats.off_rating, globalMinOff, globalMaxOff);
        const defScore = 100 - normalize(t.stats.def_rating, globalMinDef, globalMaxDef);
        const winScore = normalize(t.stats.win_pct, globalMinWin, globalMaxWin);
        const overall = (offScore * 0.4) + (defScore * 0.4) + (winScore * 0.2);

        const newT = { ...t };
        newT.normalized_scores = {
            offensive_score: parseFloat(offScore.toFixed(1)),
            defensive_score: parseFloat(defScore.toFixed(1)),
            win_pct_score: parseFloat(winScore.toFixed(1)),
            overall_rating: parseFloat(overall.toFixed(1))
        };
        delete newT.raw_prob;
        return newT;
    });

    finalData.divisions[divKey] = {
        name: divKey.charAt(0).toUpperCase() + divKey.slice(1) + " Division",
        conference: ["atlantic", "central", "southeast"].includes(divKey) ? "Eastern" : "Western",
        teams: finalTeams,
        division_analytics: {
            strongest_team: strongest,
            weakest_team: weakest,
            playoff_teams: playoffCount,
            average_off_rating: parseFloat(avgOff.toFixed(1)),
            average_def_rating: parseFloat(avgDef.toFixed(1)),
            average_win_pct: parseFloat(avgWin.toFixed(3)),
            best_offense: bestOff,
            best_defense: bestDef,
            competitiveness_index: 0.5 // dummy
        }
    };
}

// Ensure all divisions exist
const allDivisions = ['atlantic', 'central', 'southeast', 'northwest', 'pacific', 'southwest'];
allDivisions.forEach(div => {
    if (!finalData.divisions[div]) {
        finalData.divisions[div] = {
            name: div.charAt(0).toUpperCase() + div.slice(1) + " Division",
            conference: ["atlantic", "central", "southeast"].includes(div) ? "Eastern" : "Western",
            teams: [],
            division_analytics: {
                strongest_team: "N/A",
                weakest_team: "N/A",
                playoff_teams: 0,
                average_off_rating: 0,
                average_def_rating: 0,
                average_win_pct: 0,
                best_offense: "N/A",
                best_defense: "N/A",
                competitiveness_index: 0
            },
            is_coming_soon: true
        };
    }
});

fs.writeFileSync('c:/Users/Vince/Downloads/NBA-Oracle/azure_oracle_prediction.json', JSON.stringify(finalData, null, 2));
console.log('Done');
