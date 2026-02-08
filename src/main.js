/**
 * HubSpot Analytics Dashboard - Main Application
 */

import { parseCSV, validateAndNormalizeDataset, DataQualityIssue } from './data/parse.js';
import { transformDataset } from './data/transforms.js';
import { computeAllKPIs } from './kpis/compute.js';
import { generateInsights } from './kpis/insights.js';
import { getKPIsForDependencies, getKPIDefinition } from './kpis/definitions.js';
import { getKPIDisplayValue } from './kpis/compute.js';
import {
    state,
    setRawData,
    setNormalizedData,
    setMetadata,
    setKPIValues,
    setInsights,
    setQualityIssues,
    clearAllData,
    setCurrentPage,
    subscribe
} from './ui/state.js';
import {
    renderKPIGrid,
    renderTable,
    renderInsights,
    renderQualityIssues,
    updateUploadStatus,
    updateFileStatus,
    buildFilterControls,
    exportErrorReport
} from './ui/components.js';
import {
    setupEventListeners,
    populateFilterControls,
    getFilteredTableData,
    getVisibleColumns,
    setupTaskbar
} from './ui/interactions.js';

let chartsInstances = {};

/**
 * Initialize application
 */
async function init() {
    // Setup file upload handlers
    setupFileUploads();

    // Setup initial event listeners
    setupEventListeners(renderWithKPIUpdate);

    // Setup taskbar and start menu
    setupTaskbar();

    // Setup navigation
    setupNavigation();

    // Subscribe to state changes
    subscribe(render);

    // Setup reset button
    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearAllData();
            document.getElementById('dashboard-content').style.display = 'none';
            document.getElementById('upload-status').textContent = 'Data cleared. Ready to upload.';
        });
    }

    // Setup quality export
    const qualityExportBtn = document.getElementById('quality-export-btn');
    if (qualityExportBtn) {
        qualityExportBtn.addEventListener('click', () => {
            exportErrorReport(state.ui.qualityIssues);
        });
    }
}

/**
 * Setup file upload handlers
 */
function setupFileUploads() {
    const dealsUpload = document.getElementById('deals-upload');
    const leadsUpload = document.getElementById('leads-upload');

    if (dealsUpload) {
        dealsUpload.addEventListener('change', (e) => handleFileUpload(e, 'deals'));
    }

    if (leadsUpload) {
        leadsUpload.addEventListener('change', (e) => handleFileUpload(e, 'leads'));
    }

    // Drag and drop
    setupDragAndDrop();
}

/**
 * Handle file upload
 */
async function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    updateFileStatus(type, '', 'Parsing...');

    try {
        const parseResult = await parseCSV(file);

        if (!parseResult.success) {
            updateFileStatus(type, 'error', `Error: ${parseResult.errors[0]?.message || 'Parse error'}`);
            return;
        }

        // Validate and normalize
        const validationResult = validateAndNormalizeDataset(parseResult.data, type);

        if (validationResult.data.length === 0) {
            updateFileStatus(type, 'error', 'No valid data found');
            return;
        }

        // Transform (compute derived fields)
        const normalized = transformDataset(validationResult.data, type);

        // Update state
        if (type === 'leads') {
            setRawData(normalized, undefined);
            setMetadata('leads', {
                columns: Object.keys(normalized[0] || {}),
                issues: validationResult.issues
            });
        } else {
            setRawData(undefined, normalized);
            setMetadata('deals', {
                columns: Object.keys(normalized[0] || {}),
                issues: validationResult.issues
            });
        }

        updateFileStatus(type, 'success', `✓ ${normalized.length} rows loaded`);
        updateResetButton();
        processAndRender();
    } catch (error) {
        console.error('File upload error:', error);
        console.error('Stack:', error.stack);
        
        // Check for stack overflow
        if (error.message && error.message.includes('Maximum call stack')) {
            updateFileStatus(type, 'error', 'Error: Data contains invalid values. Check browser console for details.');
        } else {
            updateFileStatus(type, 'error', `Error: ${error.message}`);
        }
    }
}

/**
 * Setup drag and drop
 */
function setupDragAndDrop() {
    const uploadBoxes = document.querySelectorAll('.upload-box');

    uploadBoxes.forEach(box => {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            box.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            box.addEventListener(eventName, () => box.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            box.addEventListener(eventName, () => box.classList.remove('dragover'), false);
        });

        box.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const input = box.querySelector('input[type="file"]');
                input.files = files;
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);
            }
        }, false);
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Update reset button visibility
 */
function updateResetButton() {
    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn && (state.rawLeads || state.rawDeals)) {
        resetBtn.style.display = 'inline-block';
    }
}

/**
 * Setup navigation between pages
 */
function setupNavigation() {
    const taskbarButtons = document.querySelectorAll('.taskbar-button');
    taskbarButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            setCurrentPage(page);
        });
    });
}

/**
 * Show the current page and hide others
 */
function showCurrentPage() {
    const dashboardPage = document.getElementById('dashboard-page');
    const dealsPage = document.getElementById('deals-page');
    const leadsPage = document.getElementById('leads-page');
    
    const taskbarButtons = document.querySelectorAll('.taskbar-button');

    // Hide all pages
    if (dashboardPage) dashboardPage.style.display = 'none';
    if (dealsPage) dealsPage.style.display = 'none';
    if (leadsPage) leadsPage.style.display = 'none';

    // Remove active class from all taskbar buttons
    taskbarButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // Show current page and highlight taskbar button
    const currentPage = state.ui.currentPage;
    taskbarButtons.forEach(btn => {
        if (btn.getAttribute('data-page') === currentPage) {
            btn.classList.add('active');
        }
    });

    if (currentPage === 'dashboard' && dashboardPage) {
        dashboardPage.style.display = 'block';
    } else if (currentPage === 'deals' && dealsPage) {
        dealsPage.style.display = 'block';
    } else if (currentPage === 'leads' && leadsPage) {
        leadsPage.style.display = 'block';
    }
}

/**
 * Process data and trigger render
 */
function processAndRender() {
    if (!state.rawLeads && !state.rawDeals) {
        return;
    }

    // Update normalized data
    setNormalizedData(state.rawLeads, state.rawDeals);

    // Compute KPIs
    const kpiValues = computeAllKPIs(state.leads, state.deals, state.filters);
    setKPIValues(kpiValues);

    // Generate insights
    const insights = generateInsights(state.leads, state.deals, kpiValues);
    setInsights(insights);

    // Collect quality issues
    const allIssues = [];
    if (state.leadsMetadata.issues) {
        allIssues.push(...state.leadsMetadata.issues);
    }
    if (state.dealsMetadata.issues) {
        allIssues.push(...state.dealsMetadata.issues);
    }
    setQualityIssues(allIssues);

    // Show dashboard
    document.getElementById('dashboard-content').style.display = 'block';

    // Populate filter controls
    populateFilterControls();

    // Initial render
    render();
}

/**
 * Render with KPI update - used by event listeners to recompute KPIs on filter changes
 */
function renderWithKPIUpdate() {
    // Recompute KPIs with current filters when filters change
    if (state.leads && state.deals) {
        const kpiValues = computeAllKPIs(state.leads, state.deals, state.filters);
        state.kpiValues = kpiValues; // Update state directly without triggering listeners
    }
    // Now render the UI
    render();
}

/**
 * Main render function
 */
function render() {
    // Show/hide pages based on current page state
    showCurrentPage();

    // Only render dashboard content if on dashboard page
    if (state.ui.currentPage === 'dashboard') {
        renderKPISection();
        renderChartsSection();
        renderInsightsSection();
        renderQualitySection();
    } else if (state.ui.currentPage === 'deals') {
        renderDealsTable();
    } else if (state.ui.currentPage === 'leads') {
        renderLeadsTable();
    }

    updateUploadStatus(state.rawLeads, state.rawDeals);
}

/**
 * Render KPI section
 */
function renderKPISection() {
    const grid = document.getElementById('kpi-grid');
    if (!grid) return;

    const hasLeads = state.leads && state.leads.length > 0;
    const hasDeals = state.deals && state.deals.length > 0;
    
    // Use the renderKPIGrid from components - it handles all KPI rendering
    grid.innerHTML = renderKPIGrid(state.kpiValues, hasLeads, hasDeals);
}

/**
 * Render charts section
 */
function renderChartsSection() {
    if (!state.leads && !state.deals) {
        return;
    }

    destroyCharts();

    // Lead funnel
    if (state.leads && state.leads.length > 0) {
        renderLeadFunnelChart();
    }

    // Monthly revenue
    if (state.deals && state.deals.length > 0) {
        renderRevenueChart();
    }

    // Lead sources
    if (state.leads && state.leads.length > 0) {
        renderLeadSourceChart();
    }

    // Deal value distribution
    if (state.deals && state.deals.length > 0) {
        renderDealValueChart();
    }
}

function renderLeadFunnelChart() {
    const ctx = document.getElementById('funnel-chart');
    if (!ctx) return;

    const booked = state.leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    const shown = state.leads.filter(l => l._derived?.first_call_shown === true).length;
    const qualified = state.leads.filter(l => l._derived?.is_qualified === true).length;

    const chart = new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Booked', 'Shown', 'Qualified'],
            datasets: [{
                label: 'Count',
                data: [booked, shown, qualified],
                backgroundColor: ['#0066cc', '#4da6ff', '#1a4d99'],
                borderColor: '#0066cc',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });

    chartsInstances['funnel'] = chart;
}

function renderRevenueChart() {
    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;

    // Group by month
    const monthlyData = {};
    state.deals.forEach(deal => {
        const month = deal._derived?.payment_month;
        if (month) {
            if (!monthlyData[month]) {
                monthlyData[month] = 0;
            }
            monthlyData[month] += deal._derived?.total_paid_numeric || 0;
        }
    });

    const months = Object.keys(monthlyData).sort();
    const values = months.map(m => monthlyData[m]);

    const chart = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Monthly Revenue',
                data: values,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    chartsInstances['revenue'] = chart;
}

function renderLeadSourceChart() {
    const ctx = document.getElementById('source-chart');
    if (!ctx) return;

    const sources = {};
    state.leads.forEach(lead => {
        const source = lead.source || 'Unknown';
        sources[source] = (sources[source] || 0) + 1;
    });

    const chart = new window.Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(sources),
            datasets: [{
                data: Object.values(sources),
                backgroundColor: [
                    '#0066cc', '#4da6ff', '#1a4d99', '#66b3ff', '#003d7a',
                    '#0052a3', '#0059cc', '#1a59ff'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    chartsInstances['source'] = chart;
}

function renderDealValueChart() {
    const ctx = document.getElementById('value-distribution-chart');
    if (!ctx) return;

    const values = state.deals
        .map(d => d._derived?.contract_value_numeric || 0)
        .filter(v => v > 0)
        .sort((a, b) => a - b);

    if (values.length === 0) {
        ctx.parentElement.innerHTML = '<div style="padding: 1rem; color: var(--secondary);">No value data available</div>';
        return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketSize = (max - min) / 5 || 1;

    const buckets = {};
    for (let i = 0; i < 5; i++) {
        const start = min + (i * bucketSize);
        const end = start + bucketSize;
        const label = `$${Math.round(start / 1000)}k - $${Math.round(end / 1000)}k`;
        buckets[label] = 0;
    }

    values.forEach(v => {
        const bucket = Math.floor((v - min) / bucketSize);
        const keys = Object.keys(buckets);
        if (bucket < keys.length) {
            buckets[keys[bucket]]++;
        }
    });

    const chart = new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(buckets),
            datasets: [{
                label: 'Deal Count',
                data: Object.values(buckets),
                backgroundColor: '#ffc107',
                borderColor: '#ff9800',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    chartsInstances['distribution'] = chart;
}

function destroyCharts() {
    Object.values(chartsInstances).forEach(chart => {
        if (chart) chart.destroy();
    });
    chartsInstances = {};
}

/**
 * Render tables section
 */
function renderTablesSection() {
    renderLeadsTable();
    renderDealsTable();
}

function renderLeadsTable() {
    if (!state.leads || state.leads.length === 0) {
        document.getElementById('leads-no-data').style.display = 'block';
        document.getElementById('leads-table-container').style.display = 'none';
        return;
    }

    document.getElementById('leads-no-data').style.display = 'none';
    document.getElementById('leads-table-container').style.display = 'block';

    const filtered = getFilteredTableData('leads');
    const columns = getVisibleColumns('leads');
    const tableState = state.tableStates.leads;

    const { headerHTML, bodyHTML } = renderTable(
        filtered,
        columns,
        'leads',
        tableState.currentSort.field,
        tableState.currentSort.direction
    );

    document.getElementById('leads-thead').innerHTML = headerHTML;
    document.getElementById('leads-tbody').innerHTML = bodyHTML;
}

function renderDealsTable() {
    if (!state.deals || state.deals.length === 0) {
        document.getElementById('deals-no-data').style.display = 'block';
        document.getElementById('deals-table-container').style.display = 'none';
        return;
    }

    document.getElementById('deals-no-data').style.display = 'none';
    document.getElementById('deals-table-container').style.display = 'block';

    const filtered = getFilteredTableData('deals');
    const columns = getVisibleColumns('deals');
    const tableState = state.tableStates.deals;

    const { headerHTML, bodyHTML } = renderTable(
        filtered,
        columns,
        'deals',
        tableState.currentSort.field,
        tableState.currentSort.direction
    );

    document.getElementById('deals-thead').innerHTML = headerHTML;
    document.getElementById('deals-tbody').innerHTML = bodyHTML;
}

/**
 * Render insights section
 */
function renderInsightsSection() {
    const container = document.getElementById('insights-container');
    if (!container) return;

    container.innerHTML = renderInsights(state.ui.insights);
}

/**
 * Render quality section
 */
function renderQualitySection() {
    const details = document.getElementById('quality-details');
    const leadsIssuesEl = document.getElementById('leads-issues');
    const dealsIssuesEl = document.getElementById('deals-issues');
    const totalIssuesEl = document.getElementById('total-issues');

    if (details) {
        details.innerHTML = renderQualityIssues(state.ui.qualityIssues);
    }

    if (leadsIssuesEl) {
        const leadsIssues = state.leadsMetadata.issues?.length || 0;
        leadsIssuesEl.textContent = leadsIssues;
    }

    if (dealsIssuesEl) {
        const dealsIssues = state.dealsMetadata.issues?.length || 0;
        dealsIssuesEl.textContent = dealsIssues;
    }

    if (totalIssuesEl) {
        const total = (state.leadsMetadata.issues?.length || 0) + (state.dealsMetadata.issues?.length || 0);
        totalIssuesEl.textContent = total;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
