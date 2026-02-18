/**
 * HubSpot Analytics Dashboard - Main Application
 */

import { parseCSV, validateAndNormalizeDataset, formatCurrency, formatPercent, formatInteger } from './data/parse.js';
import { transformDataset, filterDataset } from './data/transforms.js';
import { importFromHubSpotConnector } from './data/hubspot.js';
import { saveDataSnapshot, loadDataSnapshot, clearDataSnapshot } from './data/persistence.js';
import { computeAllKPIs } from './kpis/compute.js';
import { generateInsights } from './kpis/insights.js';
import { getKPIsForDependencies } from './kpis/definitions.js';
import {
    state,
    batchStateUpdate,
    setRawData,
    setNormalizedData,
    setMetadata,
    setKPIValues,
    setInsights,
    setQualityIssues,
    clearAllData,
    setCurrentPage,
    setTableState,
    subscribe,
    loadDashboardSettings,
    updateDashboardSettings
} from './ui/state.js';
import {
    renderKPIGrid,
    renderTable,
    renderInsights,
    renderQualityIssues,
    updateUploadStatus,
    updateFileStatus,
    exportErrorReport
} from './ui/components.js';
import {
    setupEventListeners,
    populateFilterControls,
    getFilteredTableData,
    getVisibleColumns,
    showNotification
} from './ui/interactions.js';

let chartsInstances = {};
let chartResizeTimer = null;
const THEME_STORAGE_KEY = 'uiTheme';
const ROUTE_PAGES = new Set(['dashboard', 'kpis', 'charts', 'insights', 'quality', 'deals', 'leads', 'closers', 'settings']);

const DASHBOARD_CHARTS = {
    funnel: {
        label: 'Lead Funnel',
        description: 'Pipeline progression from booked calls to qualified prospects.',
        stats: (leads) => {
            const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
            const shown = leads.filter(l => l._derived?.first_call_shown === true).length;
            const qualified = leads.filter(l => l._derived?.is_qualified === true).length;
            return [
                `Booked: ${booked.toLocaleString()}`,
                `Shown: ${shown.toLocaleString()}`,
                `Qualified: ${qualified.toLocaleString()}`
            ];
        }
    },
    revenue: {
        label: 'Monthly Revenue',
        description: 'Cash collected by month based on deal payment dates.',
        stats: (leads, deals) => {
            const total = deals.reduce((sum, d) => sum + (d._derived?.total_paid_numeric || 0), 0);
            return [`Collected: ${formatCurrency(total)}`];
        }
    },
    source: {
        label: 'Leads by Source',
        description: 'Lead mix by acquisition channel.',
        stats: (leads) => {
            const sourceCount = new Set(leads.map(l => l.source).filter(Boolean)).size;
            return [`Sources: ${sourceCount}`];
        }
    },
    distribution: {
        label: 'Deal Value Distribution',
        description: 'How contract values are spread across bucketed deal ranges.',
        stats: (leads, deals) => {
            const dealsWithValue = deals.filter(d => (d._derived?.contract_value_numeric || 0) > 0).length;
            return [`Deals with value: ${dealsWithValue}`];
        }
    }
};

function getConfiguredHubSpotEndpoint() {
    const input = document.getElementById('hubspot-endpoint');
    const fromInput = String(input?.value || '').trim();
    if (fromInput) return fromInput;
    return String(state.ui.dashboardSettings.hubspotConnectorEndpoint || '').trim();
}

function syncHubSpotEndpointInputs() {
    const endpoint = String(state.ui.dashboardSettings.hubspotConnectorEndpoint || '').trim();
    const modalInput = document.getElementById('hubspot-endpoint');
    if (modalInput && modalInput.value !== endpoint) {
        modalInput.value = endpoint;
    }
}

function createSnapshotMetadata(records, metadata) {
    const rows = Array.isArray(records) ? records.length : 0;
    return {
        loaded: rows > 0,
        rowCount: rows,
        columns: rows > 0 ? Object.keys(records[0] || {}) : [],
        issues: Array.isArray(metadata?.issues) ? metadata.issues : []
    };
}

async function persistCurrentDataSnapshot(source) {
    if (!state.ui.dashboardSettings.persistDataLocally) return;
    if (!state.rawLeads && !state.rawDeals) return;

    const snapshot = {
        source: source || 'manual',
        rawLeads: state.rawLeads || null,
        rawDeals: state.rawDeals || null,
        leadsMetadata: createSnapshotMetadata(state.rawLeads, state.leadsMetadata),
        dealsMetadata: createSnapshotMetadata(state.rawDeals, state.dealsMetadata)
    };

    try {
        await saveDataSnapshot(snapshot);
    } catch (error) {
        console.warn('Failed to persist imported data snapshot:', error);
    }
}

async function clearPersistedDataSnapshot() {
    try {
        await clearDataSnapshot();
    } catch (error) {
        console.warn('Failed to clear persisted snapshot:', error);
    }
}

async function restorePersistedDataIfEnabled() {
    if (!state.ui.dashboardSettings.persistDataLocally) return false;

    try {
        const snapshot = await loadDataSnapshot();
        if (!snapshot) return false;

        const restoredLeads = Array.isArray(snapshot.rawLeads) ? snapshot.rawLeads : null;
        const restoredDeals = Array.isArray(snapshot.rawDeals) ? snapshot.rawDeals : null;

        if (!restoredLeads && !restoredDeals) return false;

        batchStateUpdate(() => {
            setRawData(restoredLeads, restoredDeals);
            setMetadata('leads', createSnapshotMetadata(restoredLeads, snapshot.leadsMetadata));
            setMetadata('deals', createSnapshotMetadata(restoredDeals, snapshot.dealsMetadata));
        });

        updateResetButton();
        processAndRender();
        showNotification('Restored last imported dataset from local browser storage.', 'info');
        return true;
    } catch (error) {
        console.warn('Failed to restore persisted snapshot:', error);
        return false;
    }
}

async function runHubSpotImport(endpoint, options = {}) {
    const {
        closeModalOnSuccess = true,
        showSuccessNotification = true,
        showErrorStatus = true,
        statusMessage = 'Connecting...',
        successPrefix = 'Imported'
    } = options;

    const connectorEndpoint = String(endpoint || '').trim();
    if (!connectorEndpoint) {
        if (showErrorStatus) {
            updateFileStatus('hubspot', 'error', 'Enter a connector URL first');
        }
        return null;
    }

    updateFileStatus('hubspot', '', statusMessage);

    const payload = await importFromHubSpotConnector(connectorEndpoint);
    const leads = Array.isArray(payload?.leads) ? payload.leads : [];
    const deals = Array.isArray(payload?.deals) ? payload.deals : [];

    batchStateUpdate(() => {
        if (leads.length > 0) {
            const leadsValidation = validateAndNormalizeDataset(leads, 'leads');
            const normalizedLeads = transformDataset(leadsValidation.data, 'leads');
            setRawData(normalizedLeads, undefined);
            setMetadata('leads', {
                columns: Object.keys(normalizedLeads[0] || {}),
                issues: leadsValidation.issues
            });
        }

        if (deals.length > 0) {
            const dealsValidation = validateAndNormalizeDataset(deals, 'deals');
            const normalizedDeals = transformDataset(dealsValidation.data, 'deals');
            setRawData(undefined, normalizedDeals);
            setMetadata('deals', {
                columns: Object.keys(normalizedDeals[0] || {}),
                issues: dealsValidation.issues
            });
        }
    });

    const totalRows = leads.length + deals.length;
    updateFileStatus(
        'hubspot',
        'success',
        `${successPrefix} ${leads.length} leads, ${deals.length} deals`
    );
    updateResetButton();
    processAndRender();
    await persistCurrentDataSnapshot('hubspot');

    if (showSuccessNotification) {
        handleImportSuccess('hubspot', totalRows, closeModalOnSuccess);
    }

    return { leads: leads.length, deals: deals.length, totalRows };
}

async function maybeAutoSyncConnectorOnLoad() {
    if (!state.ui.dashboardSettings.autoSyncConnectorOnLoad) return;

    const endpoint = String(state.ui.dashboardSettings.hubspotConnectorEndpoint || '').trim();
    if (!endpoint) {
        showNotification('Auto-sync is enabled, but no HubSpot connector endpoint is set.', 'info');
        return;
    }

    try {
        const result = await runHubSpotImport(endpoint, {
            closeModalOnSuccess: false,
            showSuccessNotification: false,
            statusMessage: 'Auto-syncing from connector...',
            successPrefix: 'Auto-synced'
        });

        if (result?.totalRows) {
            showNotification(`Auto-sync complete (${result.totalRows} rows).`, 'success');
        }
    } catch (error) {
        updateFileStatus('hubspot', 'error', `Auto-sync failed: ${error.message}`);
        showNotification('Auto-sync failed. Using last available local data.', 'error');
    }
}

/**
 * Initialize application
 */
async function init() {
    setupThemeToggle();

    // Load saved dashboard settings
    loadDashboardSettings();

    // Setup file upload handlers
    setupFileUploads();
    setupHubSpotImport();

    // Setup initial event listeners
    setupEventListeners(renderWithKPIUpdate);

    // Subscribe to state changes
    subscribe(render);

    // Setup navigation
    setupNavigation();
    syncRouteWithState(true);
    setupDashboardControls();
    setupImportModal();
    syncHubSpotEndpointInputs();
    window.addEventListener('resize', () => requestChartsResize(140));

    // Setup closers search
    setupClosersSearch(renderWithKPIUpdate);

    // Setup reset button
    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            clearAllData();
            await clearPersistedDataSnapshot();
            navigateToPage('dashboard');
            updateUploadStatus(null, null);
        });
    }

    // Setup quality export
    const qualityExportBtn = document.getElementById('quality-export-btn');
    if (qualityExportBtn) {
        qualityExportBtn.addEventListener('click', () => {
            exportErrorReport(state.ui.qualityIssues);
        });
    }

    const restored = await restorePersistedDataIfEnabled();
    if (!restored) {
        render();
    }
    maybeAutoSyncConnectorOnLoad();
}

function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
    const initialTheme = (savedTheme === 'light' || savedTheme === 'dark')
        ? savedTheme
        : (systemPrefersDark ? 'dark' : 'light');

    applyTheme(initialTheme);

    if (!toggleBtn) return;
    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
    });
}

function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    updateThemeToggleButton(nextTheme);
}

function updateThemeToggleButton(theme) {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const toggleIcon = document.getElementById('theme-toggle-icon');
    if (!toggleBtn || !toggleIcon) return;

    if (theme === 'dark') {
        toggleIcon.className = 'bi bi-sun';
        toggleBtn.setAttribute('aria-label', 'Switch to light mode');
        toggleBtn.setAttribute('title', 'Switch to light mode');
    } else {
        toggleIcon.className = 'bi bi-moon-stars';
        toggleBtn.setAttribute('aria-label', 'Switch to dark mode');
        toggleBtn.setAttribute('title', 'Switch to dark mode');
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
        batchStateUpdate(() => {
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
        });

        updateFileStatus(type, 'success', `✓ ${normalized.length} rows loaded`);
        updateResetButton();
        processAndRender();
        await persistCurrentDataSnapshot(type);
        handleImportSuccess(type, normalized.length, false);
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
 * Setup HubSpot connector import handler
 */
function setupHubSpotImport() {
    const importBtn = document.getElementById('hubspot-import-btn');
    const endpointInput = document.getElementById('hubspot-endpoint');

    if (endpointInput) {
        endpointInput.value = String(state.ui.dashboardSettings.hubspotConnectorEndpoint || '');
        endpointInput.addEventListener('change', () => {
            updateDashboardSettings({
                hubspotConnectorEndpoint: String(endpointInput.value || '').trim()
            });
        });
    }

    if (!importBtn) return;

    importBtn.addEventListener('click', async () => {
        const endpoint = getConfiguredHubSpotEndpoint();
        updateDashboardSettings({ hubspotConnectorEndpoint: endpoint });
        syncHubSpotEndpointInputs();

        try {
            await runHubSpotImport(endpoint, {
                closeModalOnSuccess: true,
                showSuccessNotification: true,
                statusMessage: 'Connecting...'
            });
        } catch (error) {
            updateFileStatus('hubspot', 'error', `Error: ${error.message}`);
        }
    });
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
    const navButtons = document.querySelectorAll('.page-nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            navigateToPage(page);
        });
    });

    window.addEventListener('popstate', () => syncRouteWithState(true));
    window.addEventListener('app:navigate', (event) => {
        const page = event?.detail?.page;
        if (page) {
            navigateToPage(page);
        }
    });
}

function getPageFromUrl() {
    const url = new URL(window.location.href);
    const pageParam = url.searchParams.get('page');
    if (ROUTE_PAGES.has(pageParam)) return pageParam;

    // Backward compatibility for old hash routes
    const hash = String(url.hash || '').replace(/^#\/?/, '');
    return ROUTE_PAGES.has(hash) ? hash : null;
}

function syncRouteWithState(replace = false) {
    const pageFromUrl = getPageFromUrl();
    if (pageFromUrl) {
        const normalizedUrl = new URL(window.location.href);
        const needsNormalize = normalizedUrl.searchParams.get('page') !== pageFromUrl || Boolean(normalizedUrl.hash);
        if (needsNormalize) {
            normalizedUrl.searchParams.set('page', pageFromUrl);
            normalizedUrl.hash = '';
            window.history.replaceState(null, '', `${normalizedUrl.pathname}${normalizedUrl.search}`);
        }
        setCurrentPage(pageFromUrl);
        return;
    }

    const fallback = state.ui.currentPage || 'dashboard';
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('page', fallback);
    nextUrl.hash = '';
    if (replace) {
        window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}`);
    } else {
        window.history.pushState(null, '', `${nextUrl.pathname}${nextUrl.search}`);
    }
    setCurrentPage(fallback);
}

function navigateToPage(page) {
    if (!ROUTE_PAGES.has(page)) return;

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('page', page);
    nextUrl.hash = '';
    const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
    const currentPath = `${window.location.pathname}${window.location.search}`;

    if (currentPath !== nextPath) {
        window.history.pushState(null, '', nextPath);
    }
    setCurrentPage(page);
    requestChartsResize(120);
}

function requestChartsResize(delay = 0) {
    if (chartResizeTimer) {
        clearTimeout(chartResizeTimer);
    }

    chartResizeTimer = setTimeout(() => {
        Object.values(chartsInstances).forEach(chart => {
            try {
                chart?.resize?.();
            } catch (error) {
                // Ignore chart resize errors for unmounted/destroyed canvases
            }
        });
    }, delay);
}

function setupDashboardControls() {
    const chartSelect = document.getElementById('dashboard-chart-select');
    const kpiSelect = document.getElementById('dashboard-kpi-select');
    const viewChartsBtn = document.getElementById('dashboard-view-charts-btn');
    const viewKpisBtn = document.getElementById('dashboard-view-kpis-btn');
    const viewInsightsBtn = document.getElementById('dashboard-view-insights-btn');
    const viewQualityBtn = document.getElementById('dashboard-view-quality-btn');
    const kpisBackBtn = document.getElementById('kpis-back-dashboard-btn');
    const chartsBackBtn = document.getElementById('charts-back-dashboard-btn');
    const insightsBackBtn = document.getElementById('insights-back-dashboard-btn');
    const qualityBackBtn = document.getElementById('quality-back-dashboard-btn');
    const toggleFiltersBtn = document.getElementById('toggle-filters-btn');

    if (chartSelect) {
        chartSelect.value = state.ui.dashboardSelection.chart;
        chartSelect.addEventListener('change', (e) => {
            state.ui.dashboardSelection.chart = e.target.value;
            render();
        });
    }

    if (kpiSelect) {
        kpiSelect.addEventListener('change', (e) => {
            state.ui.dashboardSelection.kpi = e.target.value;
            render();
        });
    }

    if (viewChartsBtn) {
        viewChartsBtn.addEventListener('click', () => navigateToPage('charts'));
    }

    if (viewKpisBtn) {
        viewKpisBtn.addEventListener('click', () => navigateToPage('kpis'));
    }

    if (viewInsightsBtn) {
        viewInsightsBtn.addEventListener('click', () => navigateToPage('insights'));
    }

    if (viewQualityBtn) {
        viewQualityBtn.addEventListener('click', () => navigateToPage('quality'));
    }

    if (kpisBackBtn) {
        kpisBackBtn.addEventListener('click', () => navigateToPage('dashboard'));
    }

    if (chartsBackBtn) {
        chartsBackBtn.addEventListener('click', () => navigateToPage('dashboard'));
    }

    if (insightsBackBtn) {
        insightsBackBtn.addEventListener('click', () => navigateToPage('dashboard'));
    }

    if (qualityBackBtn) {
        qualityBackBtn.addEventListener('click', () => navigateToPage('dashboard'));
    }

    if (toggleFiltersBtn) {
        toggleFiltersBtn.style.display = 'none';
    }

}

function setupImportModal() {
    const openButtons = document.querySelectorAll('.open-import-modal-trigger');
    const modal = document.getElementById('import-modal');
    const closeBtn = document.getElementById('import-modal-close');

    if (!modal) return;

    const closeModal = () => {
        modal.style.display = 'none';
    };

    openButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            openImportModal();
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (!modal) return;
    modal.style.display = 'none';
}

function openImportModal() {
    const modal = document.getElementById('import-modal');
    if (!modal) return;
    syncHubSpotEndpointInputs();
    modal.style.display = 'flex';
}

function handleImportSuccess(source, rowCount, forceCloseModal) {
    const hasLeads = Boolean(state.rawLeads && state.rawLeads.length > 0);
    const hasDeals = Boolean(state.rawDeals && state.rawDeals.length > 0);
    const sourceLabel = source === 'hubspot'
        ? 'HubSpot'
        : `${String(source).charAt(0).toUpperCase()}${String(source).slice(1)} file`;

    if (forceCloseModal || (hasLeads && hasDeals)) {
        closeImportModal();
        showNotification(`${sourceLabel} imported successfully (${rowCount} rows).`, 'success');
        return;
    }

    showNotification(`${sourceLabel} imported (${rowCount} rows). Import the other dataset to complete KPI coverage.`, 'info');
}

/**
 * Show the current page and hide others
 */
function showCurrentPage() {
    const pages = {
        dashboard: document.getElementById('dashboard-page'),
        kpis: document.getElementById('kpis-page'),
        charts: document.getElementById('charts-page'),
        insights: document.getElementById('insights-page'),
        quality: document.getElementById('quality-page'),
        deals: document.getElementById('deals-page'),
        leads: document.getElementById('leads-page'),
        closers: document.getElementById('closers-page'),
        settings: document.getElementById('settings-page')
    };

    const navButtons = document.querySelectorAll('.page-nav-btn');

    Object.values(pages).forEach(page => {
        if (page) {
            page.classList.remove('page-visible');
            page.classList.remove('active');
            page.classList.remove('show');
        }
    });

    // Remove active class from all nav buttons
    navButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });

    // Show current page and highlight nav button
    const currentPage = state.ui.currentPage;
    navButtons.forEach(btn => {
        if (btn.getAttribute('data-page') === currentPage) {
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
        }
    });

    const pageEl = pages[currentPage];
    if (pageEl) {
        pageEl.classList.add('page-visible');
        pageEl.classList.add('active');
        pageEl.classList.add('show');
    }

    requestChartsResize(120);

    if (currentPage === 'settings') {
        renderDashboardSettings();
    }

    document.title = `HubSpot Analytics Dashboard - ${currentPage.charAt(0).toUpperCase()}${currentPage.slice(1)}`;
}

/**
 * Process data and trigger render
 */
function processAndRender() {
    if (!state.rawLeads && !state.rawDeals) {
        return;
    }

    const nextLeads = state.rawLeads;
    const nextDeals = state.rawDeals;
    const kpiValues = computeAllKPIs(nextLeads, nextDeals, state.filters);
    const insights = generateInsights(nextLeads, nextDeals, kpiValues);
    const allIssues = [
        ...(state.leadsMetadata.issues || []),
        ...(state.dealsMetadata.issues || [])
    ];

    batchStateUpdate(() => {
        setNormalizedData(nextLeads, nextDeals);
        setKPIValues(kpiValues);
        setInsights(insights);
        setQualityIssues(allIssues);
        state.ui.lastUpdatedAt = Date.now();
    });

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
    if (state.leads || state.deals) {
        const kpiValues = computeAllKPIs(state.leads, state.deals, state.filters);
        state.kpiValues = kpiValues; // Update state directly without triggering listeners
        state.ui.lastUpdatedAt = Date.now();
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
        renderDashboardKPISection();
        renderDashboardChartSection();
        renderDashboardIntelSection();
        updateDashboardVisibility();
    } else if (state.ui.currentPage === 'kpis') {
        renderFullKPIPage();
    } else if (state.ui.currentPage === 'charts') {
        renderChartsSection();
    } else if (state.ui.currentPage === 'insights') {
        renderInsightsSection();
    } else if (state.ui.currentPage === 'quality') {
        renderQualitySection();
    } else if (state.ui.currentPage === 'deals') {
        renderDealsTable();
    } else if (state.ui.currentPage === 'leads') {
        renderLeadsTable();
    } else if (state.ui.currentPage === 'closers') {
        renderClosersTable();
    }

    updateUploadStatus(state.rawLeads, state.rawDeals);
}

/**
 * Render dashboard customization settings
 */
function renderDashboardSettingsLegacy() {
    const settingsPage = document.getElementById('settings-page');
    if (!settingsPage) return;

    const settings = state.ui.dashboardSettings;
    let html = `
        <section class="settings-section">
            <h2>Dashboard Customization</h2>
            <p style="margin-bottom: 1.5rem; color: #666;">Choose which sections to display on the main dashboard:</p>
            <div class="settings-grid">
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-kpi-spotlight" ${settings.showKpiSpotlight ? 'checked' : ''}>
                    <span>Show KPI Spotlight</span>
                </label>
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-chart-spotlight" ${settings.showChartSpotlight ? 'checked' : ''}>
                    <span>Show Chart Spotlight</span>
                </label>
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-intel-panel" ${settings.showIntelPanel ? 'checked' : ''}>
                    <span>Show Insight/Quality Previews</span>
                </label>
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-compact" ${settings.compactMode ? 'checked' : ''}>
                    <span>Compact Mode (smaller text/spacing)</span>
                </label>
            </div>
            <div style="margin-top: 1.5rem;">
                <button id="save-settings-btn" class="btn btn-primary">Save Settings</button>
                <button id="reset-settings-btn" class="btn" style="margin-left: 0.5rem;">Reset to Defaults</button>
            </div>
        </section>
    `;

    settingsPage.innerHTML = html;

    // Setup save handler
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const newSettings = {
                showFiltersPanel: document.getElementById('setting-filters').checked,
                showKpiSpotlight: document.getElementById('setting-kpi-spotlight').checked,
                showChartSpotlight: document.getElementById('setting-chart-spotlight').checked,
                showIntelPanel: document.getElementById('setting-intel-panel').checked,
                compactMode: document.getElementById('setting-compact').checked
            };
            updateDashboardSettings(newSettings);
            updateDashboardVisibility();
            navigateToPage('dashboard');
            document.getElementById('save-settings-btn').textContent = '✓ Saved!';
            setTimeout(() => {
                document.getElementById('save-settings-btn').textContent = 'Save Settings';
            }, 2000);
        });
    }

    // Setup reset handler
    const resetBtn = document.getElementById('reset-settings-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            updateDashboardSettings({
                showFiltersPanel: true,
                showKpiSpotlight: true,
                showChartSpotlight: true,
                showIntelPanel: true,
                compactMode: true
            });
            renderDashboardSettings();
        });
    }

}

function renderDashboardSettings() {
    const settingsPage = document.getElementById('settings-page');
    if (!settingsPage) return;

    const settings = state.ui.dashboardSettings;
    settingsPage.innerHTML = `
        <section class="settings-section">
            <h2>Dashboard Customization</h2>
            <p style="margin-bottom: 1.5rem; color: #666;">Choose which sections to display on the main dashboard:</p>
            <div class="settings-grid">
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-kpi-spotlight" ${settings.showKpiSpotlight ? 'checked' : ''}>
                    <span>Show KPI Spotlight</span>
                </label>
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-chart-spotlight" ${settings.showChartSpotlight ? 'checked' : ''}>
                    <span>Show Chart Spotlight</span>
                </label>
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-intel-panel" ${settings.showIntelPanel ? 'checked' : ''}>
                    <span>Show Insight/Quality Previews</span>
                </label>
                <label class="settings-checkbox">
                    <input type="checkbox" id="setting-compact" ${settings.compactMode ? 'checked' : ''}>
                    <span>Compact Mode (smaller text/spacing)</span>
                </label>
            </div>
            <div class="settings-subsection">
                <h3>Import and Sync</h3>
                <div class="settings-grid">
                    <label class="settings-checkbox">
                        <input type="checkbox" id="setting-persist-data" ${settings.persistDataLocally ? 'checked' : ''}>
                        <span>Persist imported data locally and auto-restore on load</span>
                    </label>
                    <label class="settings-checkbox">
                        <input type="checkbox" id="setting-auto-sync" ${settings.autoSyncConnectorOnLoad ? 'checked' : ''}>
                        <span>Auto-sync from HubSpot connector on app startup</span>
                    </label>
                </div>
                <div class="settings-input-row">
                    <label for="setting-connector-endpoint">HubSpot Connector Endpoint</label>
                    <input
                        type="url"
                        id="setting-connector-endpoint"
                        class="form-control form-control-sm"
                        placeholder="http://localhost:3000/api/hubspot/snapshot"
                        value="${String(settings.hubspotConnectorEndpoint || '').replace(/"/g, '&quot;')}"
                    >
                    <p class="settings-help">Keep secrets in your connector backend. The dashboard only calls this endpoint for snapshot data.</p>
                </div>
            </div>
            <div style="margin-top: 1.5rem;">
                <button id="save-settings-btn" class="btn btn-primary">Save Settings</button>
                <button id="reset-settings-btn" class="btn" style="margin-left: 0.5rem;">Reset to Defaults</button>
            </div>
        </section>
    `;

    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const persistDataLocally = document.getElementById('setting-persist-data').checked;
            const newSettings = {
                showFiltersPanel: true,
                showKpiSpotlight: document.getElementById('setting-kpi-spotlight').checked,
                showChartSpotlight: document.getElementById('setting-chart-spotlight').checked,
                showIntelPanel: document.getElementById('setting-intel-panel').checked,
                compactMode: document.getElementById('setting-compact').checked,
                persistDataLocally,
                autoSyncConnectorOnLoad: document.getElementById('setting-auto-sync').checked,
                hubspotConnectorEndpoint: String(document.getElementById('setting-connector-endpoint').value || '').trim()
            };
            updateDashboardSettings(newSettings);
            if (!persistDataLocally) {
                await clearPersistedDataSnapshot();
            }
            syncHubSpotEndpointInputs();
            updateDashboardVisibility();
            navigateToPage('dashboard');

            const saveSettingsBtn = document.getElementById('save-settings-btn');
            if (saveSettingsBtn) {
                saveSettingsBtn.textContent = 'Saved';
                setTimeout(() => {
                    saveSettingsBtn.textContent = 'Save Settings';
                }, 2000);
            }
        });
    }

    const resetBtn = document.getElementById('reset-settings-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            updateDashboardSettings({
                showFiltersPanel: true,
                showKpiSpotlight: true,
                showChartSpotlight: true,
                showIntelPanel: true,
                compactMode: true,
                persistDataLocally: true,
                autoSyncConnectorOnLoad: false,
                hubspotConnectorEndpoint: ''
            });
            await clearPersistedDataSnapshot();
            syncHubSpotEndpointInputs();
            renderDashboardSettings();
        });
    }
}

/**
 * Update dashboard section visibility based on settings
 */
function updateDashboardVisibility() {
    const settings = state.ui.dashboardSettings;
    const filtersSection = document.getElementById('dashboard-filters-section');
    const kpiSection = document.getElementById('dashboard-kpi-section');
    const chartsSection = document.getElementById('dashboard-charts-section');
    const intelSection = document.getElementById('dashboard-intel-section');
    const dashboardPage = document.getElementById('dashboard-page');
    const filtersContainer = document.getElementById('dashboard-filters-container');
    const toggleFiltersBtn = document.getElementById('toggle-filters-btn');

    if (filtersSection) filtersSection.style.display = 'block';
    if (kpiSection) kpiSection.style.display = settings.showKpiSpotlight ? 'block' : 'none';
    if (chartsSection) chartsSection.style.display = settings.showChartSpotlight ? 'block' : 'none';
    if (intelSection) intelSection.style.display = settings.showIntelPanel ? 'grid' : 'none';

    if (filtersContainer) {
        filtersContainer.classList.remove('filters-collapsed');
    }
    if (toggleFiltersBtn) {
        toggleFiltersBtn.style.display = 'none';
    }

    // Apply compact mode class
    if (dashboardPage) {
        if (settings.compactMode) {
            dashboardPage.classList.add('dashboard-compact');
        } else {
            dashboardPage.classList.remove('dashboard-compact');
        }
    }

    if (chartsSection) chartsSection.style.gridColumn = '';
    if (intelSection) intelSection.style.gridColumn = '';
    requestChartsResize(120);
}

/**
 * Render KPI section
 */
function renderDashboardKPISection() {
    const grid = document.getElementById('kpi-grid');
    const spotlight = document.getElementById('dashboard-kpi-spotlight');
    const select = document.getElementById('dashboard-kpi-select');
    if (!grid) return;

    const hasLeads = state.leads && state.leads.length > 0;
    const hasDeals = state.deals && state.deals.length > 0;
    const available = getKPIsForDependencies(hasLeads, hasDeals);

    if (select) {
        const previous = state.ui.dashboardSelection.kpi;
        select.innerHTML = available.map(kpi => {
            return `<option value="${kpi.id}">${kpi.label}</option>`;
        }).join('');

        const nextSelected = available.some(k => k.id === previous)
            ? previous
            : (available[0]?.id || null);
        if (nextSelected) {
            state.ui.dashboardSelection.kpi = nextSelected;
            select.value = nextSelected;
        }
    }

    const spotlightKpi = state.ui.dashboardSelection.kpi;
    if (spotlight) {
        if (spotlightKpi && state.kpiValues[spotlightKpi]) {
            spotlight.innerHTML = renderKPIGrid({ [spotlightKpi]: state.kpiValues[spotlightKpi] }, hasLeads, hasDeals);
        } else {
            spotlight.innerHTML = '<div class="no-data-msg">No KPI selected</div>';
        }
    }

    const previewValues = {};
    available.slice(0, 8).forEach(kpi => {
        if (state.kpiValues[kpi.id]) previewValues[kpi.id] = state.kpiValues[kpi.id];
    });
    grid.innerHTML = renderKPIGrid(previewValues, hasLeads, hasDeals);
}

function renderFullKPIPage() {
    const grid = document.getElementById('kpis-page-grid');
    if (!grid) return;

    const hasLeads = state.leads && state.leads.length > 0;
    const hasDeals = state.deals && state.deals.length > 0;
    grid.innerHTML = renderKPIGrid(state.kpiValues, hasLeads, hasDeals);
}

/**
 * Render charts section
 */
function renderChartsSection() {
    if (!state.leads && !state.deals) {
        return;
    }

    // Lead funnel
    if (state.leads && state.leads.length > 0) {
        renderLeadFunnelChart('funnel-chart', 'funnel-page');
    } else {
        destroyChart('funnel-page');
    }

    // Monthly revenue
    if (state.deals && state.deals.length > 0) {
        renderRevenueChart('revenue-chart', 'revenue-page');
    } else {
        destroyChart('revenue-page');
    }

    // Lead sources
    if (state.leads && state.leads.length > 0) {
        renderLeadSourceChart('source-chart', 'source-page');
    } else {
        destroyChart('source-page');
    }

    // Deal value distribution
    if (state.deals && state.deals.length > 0) {
        renderDealValueChart('value-distribution-chart', 'distribution-page');
    } else {
        destroyChart('distribution-page');
    }
}

function renderDashboardChartSection() {
    const select = document.getElementById('dashboard-chart-select');
    const title = document.getElementById('dashboard-focus-chart-title');
    const description = document.getElementById('dashboard-focus-chart-description');
    const statsContainer = document.getElementById('dashboard-focus-chart-stats');
    const selected = state.ui.dashboardSelection.chart || 'funnel';
    destroyChart('dashboard-focus');

    if (select && select.value !== selected) {
        select.value = selected;
    }

    const chartMeta = DASHBOARD_CHARTS[selected] || DASHBOARD_CHARTS.funnel;
    if (title) title.textContent = chartMeta.label;
    if (description) description.textContent = chartMeta.description;
    if (statsContainer) {
        const stats = chartMeta.stats(state.leads || [], state.deals || []);
        statsContainer.innerHTML = stats.map(s => `<div class="dashboard-side-stat-item">${s}</div>`).join('');
    }

    if (selected === 'funnel') {
        renderLeadFunnelChart('dashboard-focus-chart', 'dashboard-focus');
    } else if (selected === 'revenue') {
        renderRevenueChart('dashboard-focus-chart', 'dashboard-focus');
    } else if (selected === 'source') {
        renderLeadSourceChart('dashboard-focus-chart', 'dashboard-focus');
    } else if (selected === 'distribution') {
        renderDealValueChart('dashboard-focus-chart', 'dashboard-focus');
    }
}

function renderDashboardIntelSection() {
    const insightsEl = document.getElementById('dashboard-insights-preview');
    const qualityEl = document.getElementById('dashboard-quality-preview');

    if (insightsEl) {
        const firstTwo = (state.ui.insights || []).slice(0, 2);
        if (firstTwo.length === 0) {
            insightsEl.innerHTML = '<div class="dashboard-preview-empty">No insights yet</div>';
        } else {
            insightsEl.innerHTML = firstTwo.map(item => {
                return `<div class="dashboard-preview-line"><strong>${item.title || 'Insight'}:</strong> ${item.metric || item.text || ''}</div>`;
            }).join('');
        }
    }

    if (qualityEl) {
        const leadsIssues = state.leadsMetadata.issues?.length || 0;
        const dealsIssues = state.dealsMetadata.issues?.length || 0;
        const total = leadsIssues + dealsIssues;
        qualityEl.innerHTML = `
            <div class="dashboard-preview-line"><strong>Total Issues:</strong> ${total}</div>
            <div class="dashboard-preview-line"><strong>Lead Issues:</strong> ${leadsIssues}</div>
            <div class="dashboard-preview-line"><strong>Deal Issues:</strong> ${dealsIssues}</div>
        `;
    }
}

function renderLeadFunnelChart(canvasId, chartKey) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const leads = state.leads || [];

    const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    const shown = leads.filter(l => l._derived?.first_call_shown === true).length;
    const qualified = leads.filter(l => l._derived?.is_qualified === true).length;

    const config = {
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
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    };

    renderOrUpdateChart(ctx, chartKey, config);
}

function renderRevenueChart(canvasId, chartKey) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const deals = state.deals || [];

    // Group by month
    const monthlyData = {};
    deals.forEach(deal => {
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

    const config = {
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
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    };

    renderOrUpdateChart(ctx, chartKey, config);
}

function renderLeadSourceChart(canvasId, chartKey) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const leads = state.leads || [];

    const sources = {};
    leads.forEach(lead => {
        const source = lead.source || 'Unknown';
        sources[source] = (sources[source] || 0) + 1;
    });

    const config = {
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
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    };

    renderOrUpdateChart(ctx, chartKey, config);
}

function renderDealValueChart(canvasId, chartKey) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const deals = state.deals || [];

    const values = deals
        .map(d => d._derived?.contract_value_numeric || 0)
        .filter(v => v > 0)
        .sort((a, b) => a - b);

    if (values.length === 0) {
        showChartMessage(ctx, 'No value data available');
        destroyChart(chartKey);
        return;
    }
    showChartMessage(ctx, '');

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

    const config = {
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
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    };

    renderOrUpdateChart(ctx, chartKey, config);
}

function showChartMessage(ctx, message) {
    const container = ctx.parentElement;
    if (!container) return;

    let msg = container.querySelector('.chart-empty-message');
    if (!msg) {
        msg = document.createElement('div');
        msg.className = 'chart-empty-message';
        container.appendChild(msg);
    }

    msg.textContent = message;
    msg.style.display = message ? 'block' : 'none';
    ctx.style.display = message ? 'none' : 'block';
}

function renderOrUpdateChart(ctx, chartKey, config) {
    const existing = chartsInstances[chartKey];
    if (existing && existing.canvas === ctx) {
        if (existing.config.type !== config.type) {
            existing.destroy();
            const recreated = new window.Chart(ctx, config);
            chartsInstances[chartKey] = recreated;
            return recreated;
        }
        existing.config.type = config.type;
        existing.data = config.data;
        existing.options = config.options;
        existing.update();
        return existing;
    }

    if (existing) {
        existing.destroy();
    }

    const chart = new window.Chart(ctx, config);
    chartsInstances[chartKey] = chart;
    return chart;
}

function destroyChart(chartKey) {
    const chart = chartsInstances[chartKey];
    if (!chart) return;
    chart.destroy();
    delete chartsInstances[chartKey];
}

function destroyCharts() {
    Object.keys(chartsInstances).forEach(destroyChart);
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
    const columns = getVisibleColumns('leads', state.leads);
    const tableState = state.tableStates.leads;
    const container = document.getElementById('leads-table-container');
    const table = document.getElementById('leads-table');

    // Apply compact styles if in compact mode on leads page  
    if (state.ui.dashboardSettings.compactMode) {
        container.classList.add('compact-wrapper');
        table.classList.add('compact-table');
    } else {
        container.classList.remove('compact-wrapper');
        table.classList.remove('compact-table');
    }

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
    const columns = getVisibleColumns('deals', state.deals);
    const tableState = state.tableStates.deals;
    const container = document.getElementById('deals-table-container');
    const table = document.getElementById('deals-table');

    // Apply compact styles if in compact mode on deals page
    if (state.ui.dashboardSettings.compactMode) {
        container.classList.add('compact-wrapper');
        table.classList.add('compact-table');
    } else {
        container.classList.remove('compact-wrapper');
        table.classList.remove('compact-table');
    }

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

function setupClosersSearch(renderFunc) {
    const closersSearch = document.getElementById('closers-search');
    if (!closersSearch) return;

    closersSearch.addEventListener('input', (e) => {
        setTableState('closers', { searchTerm: e.target.value });
        renderFunc();
    });
}

function renderClosersTable() {
    const tbody = document.getElementById('closers-tbody');
    const tableContainer = document.getElementById('closers-table-container');
    const noData = document.getElementById('closers-no-data');

    if (!tbody || !tableContainer || !noData) return;

    if (!state.deals || state.deals.length === 0) {
        noData.style.display = 'block';
        tableContainer.style.display = 'none';
        return;
    }

    const filteredDeals = filterDataset(state.deals, state.filters);
    const closers = buildCloserStats(filteredDeals);

    const searchTerm = state.tableStates.closers.searchTerm.trim().toLowerCase();
    const visible = searchTerm
        ? closers.filter(c => c.name.toLowerCase().includes(searchTerm))
        : closers;

    if (visible.length === 0) {
        noData.style.display = 'block';
        tableContainer.style.display = 'none';
        return;
    }

    noData.style.display = 'none';
    tableContainer.style.display = 'block';

    tbody.innerHTML = visible.map(closer => {
        return `
            <tr>
                <td>${closer.name}</td>
                <td>${formatInteger(closer.deals)}</td>
                <td>${formatInteger(closer.won)}</td>
                <td>${formatPercent(closer.closeRate)}</td>
                <td>${formatInteger(closer.active)}</td>
                <td>${formatCurrency(closer.totalValue)}</td>
                <td>${formatCurrency(closer.totalCollected)}</td>
                <td>${formatCurrency(closer.averageSale)}</td>
                <td>${formatPercent(closer.collectionRate)}</td>
            </tr>
        `;
    }).join('');
}

function buildCloserStats(deals) {
    const buckets = new Map();

    deals.forEach(deal => {
        const ownerRaw = deal.deal_owner || deal.owner || 'Unassigned';
        const owner = String(ownerRaw).trim() || 'Unassigned';

        if (!buckets.has(owner)) {
            buckets.set(owner, {
                name: owner,
                deals: 0,
                won: 0,
                active: 0,
                totalValue: 0,
                totalCollected: 0
            });
        }

        const bucket = buckets.get(owner);
        bucket.deals += 1;
        if (deal._derived?.is_closed === true) bucket.won += 1;
        if (deal._derived?.is_active === true) bucket.active += 1;
        bucket.totalValue += deal._derived?.contract_value_numeric || 0;
        bucket.totalCollected += deal._derived?.total_paid_numeric || 0;
    });

    const closers = Array.from(buckets.values()).map(bucket => {
        const averageSale = bucket.deals > 0 ? bucket.totalValue / bucket.deals : 0;
        const collectionRate = bucket.totalValue > 0 ? bucket.totalCollected / bucket.totalValue : 0;
        const closeRate = bucket.deals > 0 ? bucket.won / bucket.deals : 0;

        return {
            ...bucket,
            averageSale,
            collectionRate,
            closeRate
        };
    });

    return closers.sort((a, b) => {
        if (b.totalCollected !== a.totalCollected) return b.totalCollected - a.totalCollected;
        return b.totalValue - a.totalValue;
    });
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
