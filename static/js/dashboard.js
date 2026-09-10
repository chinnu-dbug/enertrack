// Dashboard Chart.js initialization & data sync
let readingsChart = null;
let powerChart = null;

function initCharts() {
    // Readings Collected Today (Hourly Count)
    const ctxReadings = document.getElementById('readingsChart')?.getContext('2d');
    if (ctxReadings) {
        readingsChart = new Chart(ctxReadings, {
            type: 'bar',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [{
                    label: 'Readings Count',
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: '#0284c7',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Power Consumption Chart (kW over time)
    const ctxPower = document.getElementById('powerChart')?.getContext('2d');
    if (ctxPower) {
        powerChart = new Chart(ctxPower, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Power (kW)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Power (kW)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }
}

function updateDashboardCharts(stats) {
    if (!stats) return;

    // Update Readings Hourly Chart
    if (readingsChart && stats.hourly_activity) {
        const labels = stats.hourly_activity.map(item => item.hour_bin);
        const data = stats.hourly_activity.map(item => item.reading_count);
        
        readingsChart.data.labels = labels.length ? labels : ['08:00', '12:00', '16:00', '20:00'];
        readingsChart.data.datasets[0].data = data.length ? data : [2, 5, 8, 4];
        readingsChart.update();
    }

    // Update Power Trend Chart
    if (powerChart && stats.recent_trend) {
        const timeLabels = stats.recent_trend.map(item => item.timestamp.split(' ')[1] || item.timestamp);
        const powerVals = stats.recent_trend.map(item => item.power_kw);

        powerChart.data.labels = timeLabels;
        powerChart.data.datasets[0].data = powerVals;
        powerChart.update();
    }
}
