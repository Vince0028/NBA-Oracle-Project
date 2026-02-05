document.addEventListener('DOMContentLoaded', () => {
    // Ensure container exists
    let container = document.getElementById('oracle-widget');
    if (!container) {
        container = document.createElement('div');
        container.id = 'oracle-widget';
        document.body.appendChild(container);
    }

    const DATA_URL = './oracle-data.json'; // Azure will host this at the same root

    async function loadOracle() {
        try {
            const response = await fetch(DATA_URL);
            const data = await response.json();

            let html = `
                <div class="nba-oracle-container">
                    <div class="nba-oracle-header">
                        <h2>Playoff Predictor</h2>
                        <span style="font-size:10px;">Acc: ${data.oracle_metadata.global_accuracy}</span>
                    </div>
                    <table class="nba-oracle-table">
            `;

            data.teams.forEach(team => {
                const percentage = (team.win_prob * 100).toFixed(0) + '%';
                let statusClass = 'status-contend';
                if (team.win_prob >= 0.90) statusClass = 'status-lock';
                if (team.win_prob < 0.45) statusClass = 'status-out';

                html += `
                    <tr class="nba-oracle-row">
                        <td class="nba-oracle-cell"><strong>${team.id}</strong> ${team.name}</td>
                        <td class="nba-oracle-cell" style="text-align:right;">
                            <span class="prob-badge ${statusClass}">${percentage}</span>
                        </td>
                    </tr>
                `;
            });

            html += `</table></div>`;
            container.innerHTML = html;
        } catch (err) {
            console.error("Oracle failed to load from cloud storage", err);
            container.innerHTML = `<div style="padding:10px; color:red; background:white; border:1px solid #ddd;">Error loading Oracle data</div>`;
        }
    }

    loadOracle();
});
