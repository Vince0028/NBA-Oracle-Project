document.addEventListener('DOMContentLoaded', () => {
    // Create widget container
    const widget = document.createElement('div');
    widget.id = 'oracle-widget';
    widget.innerHTML = `
        <div id="oracle-header">
            <span class="oracle-icon">🔮</span>
            PLAYOFF ORACLE
        </div>
        <div id="oracle-content">
            <div id="oracle-loading" style="text-align: center; padding: 20px; color: #aaa;">Loading data...</div>
        </div>
    `;
    document.body.appendChild(widget);

    const DATA_URL = './oracle-data.json'; // Replace with your cloud-hosted JSON URL

    // Fetch data
    fetch(DATA_URL)
        .then(response => response.json())
        .then(data => {
            const contentDiv = document.getElementById('oracle-content');
            contentDiv.innerHTML = ''; // Clear loading

            if (data && data.predictions) {
                data.predictions.forEach(prediction => {
                    const probability = parseFloat(prediction.probability.replace('%', ''));
                    let status = 'Unknown';
                    let statusClass = 'status-eliminated';

                    // Derive status if not present (logic based on probability)
                    if (probability >= 90) {
                        status = 'Lock';
                        statusClass = 'status-lock';
                    } else if (probability >= 50) {
                        status = 'Contender';
                        statusClass = 'status-contender';
                    } else {
                        status = 'Eliminated';
                        statusClass = 'status-eliminated';
                    }

                    const item = document.createElement('div');
                    item.className = 'oracle-item';
                    item.innerHTML = `
                        <div class="team-info">
                            <span class="team-name">${prediction.team}</span>
                            <span class="team-status ${statusClass}">Status: ${status}</span>
                        </div>
                        <div class="probability-container">
                            <span class="probability-value">${prediction.probability}</span>
                        </div>
                    `;
                    contentDiv.appendChild(item);
                });
            } else {
                contentDiv.innerHTML = '<div style="padding:10px;">No predictions data found.</div>';
            }
        })
        .catch(error => {
            console.error('Error fetching Oracle data:', error);
            document.getElementById('oracle-content').innerHTML = '<div style="padding:10px; color: #ff6b6b;">Failed to load data.</div>';
        });
});
