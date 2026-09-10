document.addEventListener('DOMContentLoaded', () => {
    // Set default datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const defaultTimeStr = now.toISOString().slice(0, 16);
    document.getElementById('inputTimestamp').value = defaultTimeStr;

    initCharts();
    loadDashboardStats();
    loadReadingsTable();
    setupAutomaticPowerCalculation();
    setupCSVUpload();
    setupFormSubmission();
    setupLiveSimulation();
    setupKaggleImport();
    setupExport();

    // Event Listeners for Filters
    document.getElementById('tableSearchInput')?.addEventListener('input', debounce(loadReadingsTable, 300));
    document.getElementById('locationFilter')?.addEventListener('change', loadReadingsTable);
    document.getElementById('sortByFilter')?.addEventListener('change', loadReadingsTable);
    document.getElementById('btnClearForm')?.addEventListener('click', resetForm);
});

// Toast notification display
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'danger' ? 'border-danger' : ''}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-success' : 'fa-circle-exclamation text-danger'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// 1. AUTOMATIC POWER CALCULATION FORMULA: Power = Voltage * Current * Power Factor / 1000
function setupAutomaticPowerCalculation() {
    const vInput = document.getElementById('inputVoltage');
    const iInput = document.getElementById('inputCurrent');
    const pfInput = document.getElementById('inputPowerFactor');
    const pInput = document.getElementById('inputPower');

    function calculatePower() {
        const v = parseFloat(vInput.value);
        const i = parseFloat(iInput.value);
        const pf = parseFloat(pfInput.value) || 0.95;

        if (!isNaN(v) && !isNaN(i) && !isNaN(pf)) {
            const power = (v * i * pf) / 1000.0;
            pInput.value = power.toFixed(3);
        }
    }

    vInput?.addEventListener('input', calculatePower);
    iInput?.addEventListener('input', calculatePower);
    pfInput?.addEventListener('input', calculatePower);
}

// 2. LOAD STATISTICS & KPI CARDS
function loadDashboardStats() {
    fetch('/api/statistics')
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                if (document.getElementById('kpiTotalEnergy') && res.total_energy_kwh !== undefined) {
                    document.getElementById('kpiTotalEnergy').innerText = `${res.total_energy_kwh.toLocaleString()} kWh`;
                }
                if (document.getElementById('kpiTotalCost') && res.total_cost_inr !== undefined) {
                    document.getElementById('kpiTotalCost').innerText = `Total Cost: ₹${res.total_cost_inr.toLocaleString()}`;
                }

                document.getElementById('kpiTotalReadings').innerText = res.total_readings.toLocaleString();
                document.getElementById('kpiEnergyCollected').innerText = `${res.energy_collected_kwh} kWh`;
                document.getElementById('kpiPeakPower').innerText = `${res.peak_power_kw} kW`;

                // Today's Cost in ₹
                const costEl = document.getElementById('kpiCostToday');
                const rateEl = document.getElementById('kpiCostRate');
                if (costEl) {
                    costEl.innerText = `₹${res.cost_today_inr?.toFixed(2) ?? '--'}`;
                }
                if (rateEl && res.electricity_price_inr !== undefined) {
                    rateEl.innerText = `@ ₹${parseFloat(res.electricity_price_inr).toFixed(2)} / kWh`;
                }

                // Update charts with API statistics
                updateDashboardCharts(res);
            }
        })
        .catch(err => console.error('Error fetching statistics:', err));
}

// 3. READINGS TABLE FETCH & RENDER WITH SEARCH, FILTER, SORT, EDIT, DELETE
function loadReadingsTable() {
    const search = document.getElementById('tableSearchInput')?.value || '';
    const location = document.getElementById('locationFilter')?.value || 'All';
    const sortBy = document.getElementById('sortByFilter')?.value || 'timestamp';

    const url = `/api/readings?search=${encodeURIComponent(search)}&location=${encodeURIComponent(location)}&sort_by=${sortBy}&order=desc`;

    fetch(url)
        .then(res => res.json())
        .then(res => {
            const tbody = document.getElementById('readingsTableBody');
            if (!tbody) return;

            if (res.data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center py-4 text-muted">
                            No readings found matching criteria.
                        </td>
                    </tr>`;
                return;
            }

            tbody.innerHTML = res.data.map(row => {
                const dateParts = row.timestamp.split(' ');
                const dateDisplay = dateParts[0] || row.timestamp;
                const timeDisplay = dateParts[1] || '';
                const isHealthy = row.voltage >= 200 && row.voltage <= 250 && row.power_factor >= 0.85;
                const statusBadge = isHealthy
                    ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Normal</span>'
                    : '<span class="badge badge-warning" style="background:#f59e0b;color:#fff;"><i class="fa-solid fa-triangle-exclamation"></i> Alert</span>';
                
                return `
                    <tr>
                        <td><strong>${dateDisplay}</strong> <small class="text-muted">${timeDisplay}</small></td>
                        <td><i class="fa-solid fa-location-dot text-muted"></i> ${row.location}</td>
                        <td>${row.voltage} V</td>
                        <td>${row.current} A</td>
                        <td><strong>${row.power_kw} kW</strong></td>
                        <td>${row.energy_kwh} kWh</td>
                        <td>${row.power_factor}</td>
                        <td>${statusBadge}</td>
                        <td class="text-center">
                            <button class="btn-edit-sm" onclick="editReading(${row.id}, '${row.timestamp}', '${row.location}', ${row.voltage}, ${row.current}, ${row.power_kw}, ${row.energy_kwh}, ${row.power_factor})">
                                <i class="fa-solid fa-pen"></i> Edit
                            </button>
                            <button class="btn-danger-sm ms-1" onclick="deleteReading(${row.id})">
                                <i class="fa-solid fa-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        });
}

// 4. FORM SUBMISSION (ADD / UPDATE) WITH STRICT VALIDATION
function setupFormSubmission() {
    const form = document.getElementById('readingForm');
    const errAlert = document.getElementById('formErrorAlert');

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        errAlert.classList.add('d-none');
        errAlert.innerHTML = '';

        const readingId = document.getElementById('editReadingId').value;
        const timestampVal = document.getElementById('inputTimestamp').value;

        let formattedTs = timestampVal.replace('T', ' ');
        if (formattedTs.length === 16) formattedTs += ':00';

        const payload = {
            timestamp: formattedTs,
            location: document.getElementById('inputLocation').value,
            voltage: parseFloat(document.getElementById('inputVoltage').value),
            current: parseFloat(document.getElementById('inputCurrent').value),
            power_factor: parseFloat(document.getElementById('inputPowerFactor').value),
            power_kw: parseFloat(document.getElementById('inputPower').value),
            energy_kwh: parseFloat(document.getElementById('inputEnergy').value)
        };

        const method = readingId ? 'PUT' : 'POST';
        const url = readingId ? `/api/readings/${readingId}` : '/api/readings';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json().then(data => ({ status: res.status, body: data })))
        .then(res => {
            if (res.status === 200 || res.status === 201) {
                showToast(readingId ? '✓ Energy reading updated successfully' : '✓ Energy reading added successfully');
                resetForm();
                loadDashboardStats();
                loadReadingsTable();
            } else {
                const errors = res.body.errors || [res.body.message];
                errAlert.innerHTML = `<strong>⚠ Validation Error:</strong><br>${errors.join('<br>')}`;
                errAlert.classList.remove('d-none');
            }
        })
        .catch(err => {
            errAlert.innerHTML = '<strong>⚠ Server error occurred.</strong>';
            errAlert.classList.remove('d-none');
        });
    });
}

function editReading(id, timestamp, location, voltage, current, power, energy, pf) {
    document.getElementById('editReadingId').value = id;
    document.getElementById('inputTimestamp').value = timestamp.replace(' ', 'T').slice(0, 16);
    document.getElementById('inputLocation').value = location;
    document.getElementById('inputVoltage').value = voltage;
    document.getElementById('inputCurrent').value = current;
    document.getElementById('inputPower').value = power;
    document.getElementById('inputEnergy').value = energy;
    document.getElementById('inputPowerFactor').value = pf;

    document.getElementById('submitBtnText').innerText = 'Update Reading';
    window.scrollTo({ top: 100, behavior: 'smooth' });
}

function deleteReading(id) {
    if (!confirm('Are you sure you want to delete this reading?')) return;

    fetch(`/api/readings/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                showToast('Reading deleted successfully');
                loadDashboardStats();
                loadReadingsTable();
            }
        });
}

function resetForm() {
    document.getElementById('readingForm').reset();
    document.getElementById('editReadingId').value = '';
    document.getElementById('submitBtnText').innerText = 'Add Reading';
    document.getElementById('formErrorAlert').classList.add('d-none');

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('inputTimestamp').value = now.toISOString().slice(0, 16);
}

// 5. CSV DRAG AND DROP UPLOAD & VALIDATION PREVIEW
let pendingValidRows = [];

function setupCSVUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('csvFileInput');
    const previewCard = document.getElementById('csvPreviewCard');

    dropZone?.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone?.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone?.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
    });

    dropZone?.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length) handleCSVFile(files[0]);
    });

    fileInput?.addEventListener('change', (e) => {
        if (fileInput.files.length) handleCSVFile(fileInput.files[0]);
    });

    document.getElementById('btnClosePreview')?.addEventListener('click', () => {
        previewCard.classList.add('d-none');
    });

    document.getElementById('btnConfirmImport')?.addEventListener('click', () => {
        if (!pendingValidRows.length) return;

        const formData = new FormData();
        // Send a dummy file or call save directly
        fetch('/api/upload', {
            method: 'POST',
            body: createFormDataWithRows(pendingValidRows)
        })
        .then(res => res.json())
        .then(res => {
            showToast(`✓ Imported ${pendingValidRows.length} valid records successfully`);
            previewCard.classList.add('d-none');
            loadDashboardStats();
            loadReadingsTable();
        });
    });
}

function handleCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
        alert('Only CSV files are supported!');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('action', 'preview');

    fetch('/api/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(res => {
            if (res.status === 'success') {
                renderCSVPreview(res);
            } else {
                alert(`CSV Error: ${res.message}`);
            }
        });
}

function renderCSVPreview(res) {
    const previewCard = document.getElementById('csvPreviewCard');
    const summaryDiv = document.getElementById('validationSummary');
    const tbody = document.getElementById('previewTableBody');

    pendingValidRows = res.valid_rows;

    summaryDiv.innerHTML = `
        <span class="badge badge-success fs-6 px-3 py-2">✓ ${res.valid_count} records valid</span>
        <span class="badge badge-danger fs-6 px-3 py-2 ms-2">⚠ ${res.invalid_count} records contain errors</span>
    `;

    let html = '';

    // Valid rows preview
    res.valid_rows.slice(0, 5).forEach((row, i) => {
        html += `
            <tr>
                <td>${i + 1}</td>
                <td>${row.timestamp}</td>
                <td>${row.location}</td>
                <td>${row.voltage} V</td>
                <td>${row.current} A</td>
                <td>${row.power_kw} kW</td>
                <td>${row.energy_kwh} kWh</td>
                <td>${row.power_factor}</td>
                <td><span class="badge badge-success">Valid</span></td>
            </tr>`;
    });

    // Invalid rows preview with highlighted invalid cells
    res.invalid_rows.slice(0, 5).forEach((item) => {
        const d = item.data;
        const reasons = item.reasons.join('; ');
        html += `
            <tr class="table-danger">
                <td>${item.row_num}</td>
                <td>${d.timestamp || ''}</td>
                <td>${d.location || ''}</td>
                <td class="${reasons.includes('Voltage') ? 'invalid-cell' : ''}">${d.voltage} V</td>
                <td class="${reasons.includes('Current') ? 'invalid-cell' : ''}">${d.current} A</td>
                <td class="${reasons.includes('Power') ? 'invalid-cell' : ''}">${d.power_kw} kW</td>
                <td class="${reasons.includes('Energy') ? 'invalid-cell' : ''}">${d.energy_kwh} kWh</td>
                <td class="${reasons.includes('Power Factor') ? 'invalid-cell' : ''}">${d.power_factor}</td>
                <td><span class="badge badge-danger" title="${reasons}">Invalid: ${reasons}</span></td>
            </tr>`;
    });

    tbody.innerHTML = html;
    previewCard.classList.remove('d-none');
    previewCard.scrollIntoView({ behavior: 'smooth' });
}

function createFormDataWithRows(rows) {
    const csvContent = "timestamp,location,voltage,current,power_kw,energy_kwh,power_factor\n" +
        rows.map(r => `${r.timestamp},${r.location},${r.voltage},${r.current},${r.power_kw},${r.energy_kwh},${r.power_factor}`).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'import.csv');
    formData.append('action', 'save');
    return formData;
}

// 6. LIVE SIMULATION COUNTER & STREAM UPDATES (EVERY 5 SECONDS)
function setupLiveSimulation() {
    let countdown = 5;

    function fetchLiveDemoData() {
        fetch('/api/live')
            .then(res => res.json())
            .then(res => {
                if (res.status === 'success') {
                    const m = res.meter_data;
                    document.getElementById('liveLastTime').innerText = res.last_reading_time;
                    document.getElementById('liveReadingsCount').innerText = res.readings_today;
                    document.getElementById('demoV').innerText = `${m.voltage} V`;
                    document.getElementById('demoI').innerText = `${m.current} A`;
                    document.getElementById('demoP').innerText = `${m.power_kw} kW`;
                    document.getElementById('demoPF').innerText = m.power_factor;

                    // Header ticker update
                    const navPower = document.getElementById('navPowerVal');
                    if (navPower) navPower.innerText = `${m.power_kw} kW`;
                }
            });
    }

    fetchLiveDemoData();

    setInterval(() => {
        countdown--;
        if (countdown <= 0) {
            countdown = 5;
            fetchLiveDemoData();
        }
        const cdElem = document.getElementById('liveCountdown');
        if (cdElem) cdElem.innerText = countdown;
    }, 1000);
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// 7. KAGGLE DATASET IMPORT
function setupKaggleImport() {
    const btn = document.getElementById('btnImportKaggle');
    const statusDiv = document.getElementById('kaggleImportStatus');
    if (!btn) return;

    btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
        statusDiv.className = 'mt-2';
        statusDiv.innerHTML = '<span class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Connecting to Kaggle dataset...</span>';

        fetch('/api/import-kaggle', { method: 'POST' })
            .then(res => res.json())
            .then(res => {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Import Kaggle Dataset';
                if (res.status === 'success') {
                    statusDiv.innerHTML = `
                        <div class="kaggle-success-msg">
                            <i class="fa-solid fa-circle-check text-success"></i>
                            <strong>${res.message}</strong>
                            ${res.skipped_count > 0 ? `<br><small class="text-muted">${res.skipped_count} rows skipped (validation).</small>` : ''}
                        </div>`;
                    showToast(`✓ ${res.imported_count} Kaggle records imported!`);
                    loadDashboardStats();
                    loadReadingsTable();
                } else {
                    statusDiv.innerHTML = `<div class="text-danger"><i class="fa-solid fa-circle-exclamation"></i> ${res.message}</div>`;
                    showToast(res.message, 'danger');
                }
            })
            .catch(err => {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Import Kaggle Dataset';
                statusDiv.innerHTML = `<div class="text-danger"><i class="fa-solid fa-circle-exclamation"></i> Network error. Please try again.</div>`;
            });
    });
}

// 8. EXPORT DATA (CSV)
function setupExport() {
    const btn = document.getElementById('btnExportCsv');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const search = document.getElementById('tableSearchInput')?.value?.trim() || '';
        const location = document.getElementById('locationFilter')?.value || 'All';

        showToast('Preparing your CSV export...', 'success');

        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (location && location !== 'All') params.set('location', location);

        const exportUrl = `/api/export?${params.toString()}`;

        // Create invisible anchor to trigger browser file download
        const a = document.createElement('a');
        a.href = exportUrl;
        a.setAttribute('download', '');
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 1000);
    });
}

// 9. REAL-TIME INTERNET TELEMETRY FETCH & INGESTION
function collectionFetchInternet() {
    const btn = document.getElementById('btnCollectionFetchInternet');
    const statusDiv = document.getElementById('collectionInternetStatus');
    if (!btn || !statusDiv) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching from Open Grid API...';
    statusDiv.classList.remove('d-none');
    statusDiv.innerHTML = '<div class="text-info"><i class="fa-solid fa-satellite fa-spin"></i> Contacting National Grid ESO API...</div>';

    fetch('/api/internet-telemetry/examine')
        .then(r => r.json())
        .then(data => {
            if (data.status !== 'success') {
                throw new Error(data.message || 'Failed to fetch internet telemetry');
            }
            const readings = data.examination.meter_readings;
            const kw = data.examination.total_power_kw;
            const cost = data.examination.period_cost_inr;

            statusDiv.innerHTML = `<div class="text-info"><i class="fa-solid fa-bolt"></i> Examined: <strong>${kw} kW</strong> (₹${cost}). Ingesting readings...</div>`;

            return fetch('/api/internet-telemetry/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ readings: readings })
            });
        })
        .then(r => r.json())
        .then(res => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Fetch & Ingest Real-Time Internet Data';
            if (res.status === 'success') {
                statusDiv.innerHTML = `<div class="text-success"><i class="fa-solid fa-circle-check"></i> ${res.message}</div>`;
                showToast(`✓ Ingested ${res.imported_count} live internet readings!`);
                loadDashboardStats();
                loadReadingsTable();
            } else {
                statusDiv.innerHTML = `<div class="text-danger"><i class="fa-solid fa-circle-exclamation"></i> ${res.message}</div>`;
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Fetch & Ingest Real-Time Internet Data';
            statusDiv.innerHTML = `<div class="text-danger"><i class="fa-solid fa-circle-exclamation"></i> ${err.message || err}</div>`;
        });
}
