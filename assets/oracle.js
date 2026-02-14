// NBA Oracle AI - Division Predictions UI
let oracleData = null;
let currentDivision = 'atlantic';

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
        const response = await fetch('./azure_oracle_prediction.json');
        oracleData = await response.json();
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
        // Always render all tabs now
        const isActive = key === currentDivision ? ' active' : '';
        html += '<button class="oracle-tab' + isActive + '" data-division="' + key + '" onclick="switchDivision(\'' + key + '\')">';
        html += (div ? div.name.replace(' Division', '') : key.charAt(0).toUpperCase() + key.slice(1));
        html += '<span class="tab-conference">' + (div ? div.conference : (['atlantic', 'central', 'southeast'].includes(key) ? 'Eastern' : 'Western')) + '</span>';
        html += '</button>';
    });
    tabsContainer.innerHTML = html;
}

function switchDivision(divKey) {
    currentDivision = divKey;
    // Update active tab
    document.querySelectorAll('.oracle-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-division') === divKey);
    });
    renderDivision(divKey);
}

function renderDivision(divKey) {
    const container = document.getElementById('oracle-division-content');
    const div = oracleData.divisions[divKey];

    if (!div || div.is_coming_soon || div.teams.length === 0) {
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

    // Analytics bar
    const analytics = div.division_analytics;
    html += '<div class="oracle-analytics-bar">';
    html += renderStatCard('Strongest', analytics.strongest_team.split(' ').pop(), '');
    html += renderStatCard('Best Offense', analytics.best_offense.split(' ').pop(), '');
    html += renderStatCard('Best Defense', analytics.best_defense.split(' ').pop(), '');
    html += renderStatCard('Avg Off Rtg', analytics.average_off_rating.toString(), '');
    html += renderStatCard('Avg Def Rtg', analytics.average_def_rating.toString(), '');
    html += renderStatCard('Playoff Teams', analytics.playoff_teams + ' / ' + div.teams.length, '');
    html += '</div>';

    // Teams standings table
    html += '<table class="oracle-teams-table">';
    html += '<thead><tr>';
    html += '<th>#</th><th>Team</th><th>W-L</th><th>Win%</th><th>Off Rtg</th><th>Def Rtg</th><th>Net</th><th>Rating</th><th>Trend</th>';
    html += '</tr></thead><tbody>';
    div.teams.forEach((team, i) => {
        const playoffClass = team.playoff_status === 'clinched' ? 'clinched' : 'eliminated';
        const playoffLabel = team.playoff_status === 'clinched' ? 'IN' : 'OUT';
        const ratingPct = team.normalized_scores.overall_rating;
        const ratingClass = ratingPct >= 65 ? 'high' : (ratingPct >= 35 ? 'mid' : 'low');
        html += '<tr>';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td><span class="team-name">' + team.team + '</span>';
        html += '<span class="playoff-badge ' + playoffClass + '">' + playoffLabel + '</span></td>';
        html += '<td>' + team.stats.wins + '-' + team.stats.losses + '</td>';
        html += '<td><strong>' + (team.stats.win_pct * 100).toFixed(1) + '%</strong></td>';
        html += '<td>' + team.stats.off_rating + '</td>';
        html += '<td>' + team.stats.def_rating + '</td>';
        html += '<td><strong>' + (team.stats.net_rating > 0 ? '+' : '') + team.stats.net_rating + '</strong></td>';
        html += '<td><div style="display:flex;align-items:center;gap:6px;"><span style="font-weight:700;font-size:12px;">' + ratingPct.toFixed(0) + '</span>';
        html += '<div class="oracle-rating-bar"><div class="oracle-rating-fill ' + ratingClass + '" style="width:' + ratingPct + '%"></div></div></div></td>';
        html += '<td><span class="trend-badge ' + team.trend + '">' + capitalize(team.trend) + '</span></td>';
        html += '</tr>';
    });
    html += '</tbody></table>';

    // Matches
    html += '<h3 class="oracle-matches-title">AI Match Predictions (' + div.matches.length + ' matchups)</h3>';
    html += '<div class="oracle-matches-grid">';
    div.matches.forEach(match => {
        html += renderMatchCard(match);
    });
    html += '</div>';

    container.innerHTML = html;
}

function renderStatCard(label, value) {
    return '<div class="oracle-stat-card">' +
        '<div class="stat-label">' + label + '</div>' +
        '<div class="stat-value">' + value + '</div>' +
        '</div>';
}

function renderMatchCard(match) {
    const p = match.prediction;
    const a = match.ai_analysis;

    const homeProb = (p.home_win_probability * 100).toFixed(1);
    const awayProb = (p.away_win_probability * 100).toFixed(1);
    const homeFavored = p.home_win_probability >= 0.5;

    let html = '<div class="oracle-match-card">';

    // Header
    html += '<div class="oracle-match-header">';
    html += '<span class="confidence-badge ' + p.confidence + '">' + p.confidence.replace('_', ' ') + '</span>';
    html += '<span class="match-id">' + match.match_id + '</span>';
    html += '</div>';

    // Teams + probabilities
    html += '<div class="oracle-match-teams">';
    html += '<div class="oracle-match-team">';
    html += '<div class="team-name">' + shortenTeam(match.home_team) + '</div>';
    html += '<div class="team-prob ' + (homeFavored ? 'favored' : 'underdog') + '">' + homeProb + '%</div>';
    html += '</div>';
    html += '<div class="oracle-match-vs">VS</div>';
    html += '<div class="oracle-match-team">';
    html += '<div class="team-name">' + shortenTeam(match.away_team) + '</div>';
    html += '<div class="team-prob ' + (!homeFavored ? 'favored' : 'underdog') + '">' + awayProb + '%</div>';
    html += '</div>';
    html += '</div>';

    // Predicted score
    html += '<div class="oracle-match-score">';
    html += 'Predicted Score: <span class="predicted-score">' + p.predicted_score.home + ' - ' + p.predicted_score.away + '</span>';
    html += '</div>';

    // Key factors
    if (a.key_factors && a.key_factors.length > 0) {
        html += '<div class="oracle-match-analysis">';
        a.key_factors.forEach(function (f) {
            html += '<div class="factor">' + f + '</div>';
        });
        html += '</div>';
    }

    // Winner
    html += '<div class="oracle-match-winner">';
    html += 'Predicted Winner: ' + p.predicted_winner;
    html += '</div>';

    // Probability bar chart
    html += '<div class="oracle-prob-chart">';
    html += '<div class="chart-label">Win Probability</div>';
    html += '<div class="oracle-prob-bar-wrap">';
    html += '<div class="oracle-prob-bar-home" style="width:' + homeProb + '%"><span>' + homeProb + '%</span></div>';
    html += '<div class="oracle-prob-bar-away" style="width:' + awayProb + '%"><span>' + awayProb + '%</span></div>';
    html += '</div>';
    html += '<div class="oracle-prob-legend">';
    html += '<span class="legend-item"><span class="legend-dot home"></span>' + shortenTeam(match.home_team) + '</span>';
    html += '<span class="legend-item"><span class="legend-dot away"></span>' + shortenTeam(match.away_team) + '</span>';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    return html;
}

function shortenTeam(name) {
    // Keep city + nickname but shorten for card display
    const parts = name.split(' ');
    if (parts.length >= 3) {
        // e.g. "Oklahoma City Thunder" -> "OKC Thunder"
        const abbreviations = {
            'Oklahoma City': 'OKC',
            'Golden State': 'GS',
            'San Antonio': 'SA',
            'Los Angeles': 'LA',
            'New York': 'NY',
            'New Orleans': 'NO',
            'Trail Blazers': 'Blazers'
        };
        for (const [full, short] of Object.entries(abbreviations)) {
            if (name.includes(full)) {
                return name.replace(full, short);
            }
        }
    }
    return name;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Playoff Predictor widget with LIVE badge + Division Predictions button
document.addEventListener('DOMContentLoaded', function () {
    let container = document.getElementById('oracle-widget');
    if (!container) {
        container = document.createElement('div');
        container.id = 'oracle-widget';
        document.body.appendChild(container);
    }

    fetch('./oracle-data.json')
        .then(function (response) { return response.json(); })
        .then(function (data) {
            let html = '<div class="nba-oracle-container">';

            // Header — black bar with uppercase title
            html += '<div class="nba-oracle-header">';
            html += '<h2>Playoff Predictor</h2>';
            html += '<div style="display:flex;align-items:center;gap:8px;">';
            html += '<span class="oracle-live-badge">LIVE</span>';
            html += '<span style="font-size:9px;color:#888;letter-spacing:0.5px;">' + data.oracle_metadata.global_accuracy + '</span>';
            html += '</div>';
            html += '</div>';

            // Team rows
            html += '<table class="nba-oracle-table">';
            data.teams.forEach(function (team) {
                const percentage = (team.win_prob * 100).toFixed(0) + '%';
                let statusClass = 'status-contend';
                if (team.win_prob >= 0.90) statusClass = 'status-lock';
                if (team.win_prob < 0.45) statusClass = 'status-out';

                html += '<tr class="nba-oracle-row">';
                html += '<td class="nba-oracle-cell"><strong>' + team.id + '</strong> ' + team.name + '</td>';
                html += '<td class="nba-oracle-cell" style="text-align:right;">';
                html += '<span class="prob-badge ' + statusClass + '">' + percentage + '</span>';
                html += '</td></tr>';
            });
            html += '</table>';

            // CTA button — full-width, no radius
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
