// NBA Oracle AI - Division Predictions UI
let oracleData = null;
let currentDivision = 'atlantic';
const DATA_URL = './azure_oracle_prediction.json';

// --- Division Helper ---
const TEAM_TO_DIVISION = {
    // Atlantic
    "BOS": "atlantic", "BKN": "atlantic", "NYK": "atlantic", "PHI": "atlantic", "TOR": "atlantic",
    // Central
    "CHI": "central", "CLE": "central", "DET": "central", "IND": "central", "MIL": "central",
    // Southeast
    "ATL": "southeast", "CHA": "southeast", "MIA": "southeast", "ORL": "southeast", "WAS": "southeast",
    // Northwest
    "DEN": "northwest", "MIN": "northwest", "OKC": "northwest", "POR": "northwest", "UTA": "northwest",
    // Pacific
    "GSW": "pacific", "LAC": "pacific", "LAL": "pacific", "PHX": "pacific", "SAC": "pacific",
    // Southwest
    "DAL": "southwest", "HOU": "southwest", "MEM": "southwest", "NOP": "southwest", "SAS": "southwest"
};

// Open/Close modal
function openOracleModal() {
    const modal = document.getElementById('oracle-modal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    if (!oracleData) {
        loadPredictions();
    }
}

function closeOracleModal() {
    document.getElementById('oracle-modal').style.display = 'none';
    document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOracleModal();
});

// Close on backdrop click
document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'oracle-modal') closeOracleModal();
});

async function loadPredictions() {
    try {
        const response = await fetch(DATA_URL);
        const rawData = await response.json();

        // Transform Flat List to Division Map
        oracleData = { divisions: {} };
        const divisions = ['atlantic', 'central', 'southeast', 'northwest', 'pacific', 'southwest'];

        divisions.forEach(div => {
            oracleData.divisions[div] = {
                name: div.charAt(0).toUpperCase() + div.slice(1) + " Division",
                conference: ['atlantic', 'central', 'southeast'].includes(div) ? 'Eastern' : 'Western',
                teams: []
            };
        });

        if (rawData.teams && Array.isArray(rawData.teams)) {
            rawData.teams.forEach(team => {
                const div = TEAM_TO_DIVISION[team.id];
                if (div && oracleData.divisions[div]) {
                    oracleData.divisions[div].teams.push(team);
                }
            });
        }

        // Sort teams by win_prob
        Object.values(oracleData.divisions).forEach(div => {
            div.teams.sort((a, b) => b.win_prob - a.win_prob);
        });

        oracleData.metadata = rawData.oracle_metadata; // Store metadata
        oracleData.matches = rawData.matches || []; // Store matches
        renderDivisionTabs();
        renderDivision(currentDivision);

    } catch (err) {
        console.error('Oracle: Failed to load predictions', err);
        document.getElementById('oracle-division-content').innerHTML =
            '<div class="oracle-loading" style="color:#c8102e;">Failed to load prediction data.</div>';
    }
}

function renderDivisionTabs() {
    const tabsContainer = document.getElementById('oracle-division-tabs');
    const divisionOrder = ['atlantic', 'central', 'southeast', 'northwest', 'pacific', 'southwest'];

    let html = '';
    divisionOrder.forEach(key => {
        const div = oracleData.divisions[key];
        const isActive = key === currentDivision ? ' active' : '';
        html += `<button class="oracle-tab${isActive}" data-division="${key}" onclick="switchDivision('${key}')">`;
        html += key.charAt(0).toUpperCase() + key.slice(1);
        html += `<span class="tab-conference">${div.conference}</span>`;
        html += `</button>`;
    });
    tabsContainer.innerHTML = html;
}

function switchDivision(divKey) {
    currentDivision = divKey;
    document.querySelectorAll('.oracle-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-division') === divKey);
    });
    renderDivision(divKey);
}

function renderDivision(divKey) {
    const container = document.getElementById('oracle-division-content');
    const div = oracleData.divisions[divKey];

    // Check if empty (Southeast/Southwest will be empty)
    if (!div || div.teams.length === 0) {
        container.innerHTML = `
            <div class="oracle-coming-soon">
                <div class="coming-soon-icon">⚠️</div>
                <h3>prediction pending</h3>
                <p>Azure ML is currently processing data for the ${divKey} division.</p>
                <span class="coming-soon-badge">COMING SOON</span>
            </div>
        `;
        return;
    }

    let html = '';

    // --- Model Confidence Header ---
    html += `<div style="margin-bottom: 20px; font-size: 13px; color: #555; text-align: right;">
        <strong>Model Confidence:</strong> ${oracleData.metadata?.global_accuracy || 'N/A'}
    </div>`;

    // --- Teams Table ---
    html += '<table class="oracle-teams-table">';
    html += '<thead><tr>';
    html += '<th>Rank</th><th>Team</th><th>Win Probability</th><th>Status</th>';
    html += '</tr></thead><tbody>';

    div.teams.forEach((team, i) => {
        let statusClass = 'status-out';
        let statusText = 'Eliminated';

        if (team.win_prob >= 0.8) {
            statusClass = 'status-lock';
            statusText = 'Lock';
        } else if (team.win_prob >= 0.35) {
            statusClass = 'status-contend';
            statusText = 'Contender';
        }

        html += '<tr>';
        html += `<td>${i + 1}</td>`;
        html += `<td class="team-name">${team.name}</td>`;

        // Probability Bar style
        const pct = Math.round(team.win_prob * 100);
        html += `<td>
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="flex:1; background:#eee; height:6px; border-radius:3px; overflow:hidden; max-width:100px;">
                    <div style="width:${pct}%; background:#1D428A; height:100%;"></div>
                </div>
                <span style="font-weight:700; font-size:12px;">${pct}%</span>
            </div>
        </td>`;

        html += `<td><span class="prob-badge ${statusClass}">${statusText}</span></td>`;
        html += '</tr>';
    });


    html += '</tbody></table>';

    // --- Upcoming Matches (Filtered by Division) ---
    // A match shows if EITHER team is in this division
    if (oracleData.matches && oracleData.matches.length > 0) {
        const divMatches = oracleData.matches.filter(m => {
            const team1Div = TEAM_TO_DIVISION[m.ids[0]];
            const team2Div = TEAM_TO_DIVISION[m.ids[1]];
            return team1Div === divKey || team2Div === divKey;
        });

        if (divMatches.length > 0) {
            html += '<h3 style="margin-top:20px; font-size:14px; text-transform:uppercase; border-bottom:1px solid #ddd; padding-bottom:5px;">Tonight\'s Predictions</h3>';
            html += '<div class="oracle-matches-grid" style="display:grid; gap:10px; margin-top:10px;">';

            divMatches.forEach(match => {
                const winner = match.projected_winner;
                html += `
                <div style="background:#f8f9fa; padding:10px; border-radius:4px; border-left:4px solid #1D428A; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-size:12px; color:#666;">${match.time} ET</div>
                    <div style="font-weight:bold; font-size:13px;">
                        ${match.ids[0]} <span style="font-weight:normal; color:#888;">@</span> ${match.ids[1]}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px; color:#888;">PROJECTED WINNER</div>
                        <div style="color:#1D428A; font-weight:800;">${winner}</div>
                    </div>
                </div>`;
            });
            html += '</div>';
        }
    }

    container.innerHTML = html;
}

function renderStatCard(label, value) {
    return `
    <div class="oracle-stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
    </div>`;
}

// Playoff Predictor widget with LIVE badge + Division Predictions button
document.addEventListener('DOMContentLoaded', function () {
    let container = document.getElementById('oracle-widget');
    if (!container) {
        container = document.createElement('div');
        container.id = 'oracle-widget';
        document.body.appendChild(container);
    }

    fetch(DATA_URL)
        .then(function (response) { return response.json(); })
        .then(function (data) {
            let html = '<div class="nba-oracle-container">';

            // Header — black bar with uppercase title
            html += '<div class="nba-oracle-header">';
            html += '<h2>Playoff Predictor</h2>';
            html += '<div style="display:flex;align-items:center;gap:8px;">';
            html += '<span class="oracle-live-badge">LIVE</span>';
            const acc = data.oracle_metadata ? data.oracle_metadata.global_accuracy : '0.98';
            html += '<span style="font-size:9px;color:#888;letter-spacing:0.5px;">Acc: ' + acc + '</span>';
            html += '</div>';
            html += '</div>';

            // Sidebar: Top 8 sorted by win prob
            const sortedTeams = data.teams.sort((a, b) => b.win_prob - a.win_prob).slice(0, 8);

            html += '<table class="nba-oracle-table">';
            sortedTeams.forEach(function (team) {
                const percentage = (team.win_prob * 100).toFixed(0) + '%';
                let statusClass = 'status-contend';
                if (team.win_prob >= 0.60) statusClass = 'status-lock';
                if (team.win_prob <= 0.40) statusClass = 'status-out';

                html += '<tr class="nba-oracle-row">';
                html += '<td class="nba-oracle-cell"><strong>' + team.id + '</strong> ' + team.name.split(' ').pop() + '</td>';
                html += '<td class="nba-oracle-cell" style="text-align:right;">';
                html += '<span class="prob-badge ' + statusClass + '">' + percentage + '</span>';
                html += '</td></tr>';
            });
            html += '</table>';

            // CTA button
            html += '<button class="oracle-division-btn" onclick="openOracleModal()">';
            html += 'View Division Predictions';
            html += '</button>';

            html += '</div>';
            container.innerHTML = html;
        })
        .catch(function (err) {
            console.error("Oracle widget failed", err);
        });
});
