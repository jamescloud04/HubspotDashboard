/**
 * Global State Management
 * Manages application data, filters, and computed values
 */

/**
 * Global app state
 */
export const state = {
    // Raw and normalized data
    rawLeads: null,
    rawDeals: null,
    leads: null,
    deals: null,

    // Parsed data metadata
    leadsMetadata: {
        loaded: false,
        rowCount: 0,
        columns: [],
        issues: []
    },
    dealsMetadata: {
        loaded: false,
        rowCount: 0,
        columns: [],
        issues: []
    },

    // Computed KPI values
    kpiValues: {},

    // Current filters
    filters: {
        dateStart: null,
        dateEnd: null,
        activeOnly: false,
        leadSource: null,
        dealStatus: null,
        dqOnly: false
    },

    // Table states
    tableStates: {
        leads: {
            currentSort: { field: null, direction: 'asc' },
            searchTerm: '',
            showDQOnly: false
        },
        deals: {
            currentSort: { field: null, direction: 'asc' },
            searchTerm: '',
            showDQOnly: false
        },
        closers: {
            currentSort: { field: null, direction: 'desc' },
            searchTerm: ''
        }
    },

    // UI state
    ui: {
        currentPage: 'dashboard',  // 'dashboard', 'kpis', 'charts', 'insights', 'quality', 'deals', 'leads', 'closers', or 'settings'
        selectedRow: null,
        insights: [],
        qualityIssues: [],
        lastUpdatedAt: null,
        dashboardSelection: {
            chart: 'funnel',
            kpi: 'deals_total_value'
        },
        // Dashboard customization
        dashboardSettings: getDefaultDashboardSettings()
    }
};

// Event listeners for state changes
const listeners = new Set();
let batchDepth = 0;
let pendingNotify = false;

/**
 * Subscribe to state changes
 */
export function subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
    if (batchDepth > 0) {
        pendingNotify = true;
        return;
    }

    listeners.forEach(callback => callback(state));
}

function flushNotificationsIfNeeded() {
    if (batchDepth === 0 && pendingNotify) {
        pendingNotify = false;
        listeners.forEach(callback => callback(state));
    }
}

function getDefaultDashboardSettings() {
    return {
        showFiltersPanel: true,
        showKpiSpotlight: true,
        showChartSpotlight: true,
        showIntelPanel: true,
        compactMode: true,
        persistDataLocally: true,
        autoSyncConnectorOnLoad: false,
        hubspotConnectorEndpoint: ''
    };
}

/**
 * Batch multiple mutations into a single UI update
 */
export function batchStateUpdate(mutator) {
    batchDepth += 1;
    try {
        mutator(state);
    } finally {
        batchDepth = Math.max(0, batchDepth - 1);
        flushNotificationsIfNeeded();
    }
}

/**
 * Update raw data
 */
export function setRawData(leads, deals) {
    if (leads !== undefined) {
        state.rawLeads = leads;
        state.leadsMetadata.rowCount = leads ? leads.length : 0;
        state.leadsMetadata.loaded = leads !== null;
    }
    if (deals !== undefined) {
        state.rawDeals = deals;
        state.dealsMetadata.rowCount = deals ? deals.length : 0;
        state.dealsMetadata.loaded = deals !== null;
    }
    notifyListeners();
}

/**
 * Update normalized data
 */
export function setNormalizedData(leads, deals) {
    if (leads !== undefined) {
        state.leads = leads;
    }
    if (deals !== undefined) {
        state.deals = deals;
    }
    notifyListeners();
}

/**
 * Update metadata
 */
export function setMetadata(type, metadata) {
    if (type === 'leads') {
        state.leadsMetadata = { ...state.leadsMetadata, ...metadata };
    } else if (type === 'deals') {
        state.dealsMetadata = { ...state.dealsMetadata, ...metadata };
    }
    notifyListeners();
}

/**
 * Update KPI values
 */
export function setKPIValues(kpiValues) {
    state.kpiValues = kpiValues;
    notifyListeners();
}

/**
 * Update filters
 */
export function setFilters(filters) {
    state.filters = { ...state.filters, ...filters };
    notifyListeners();
}

/**
 * Reset all filters
 */
export function resetFilters() {
    state.filters = {
        dateStart: null,
        dateEnd: null,
        activeOnly: false,
        leadSource: null,
        dealStatus: null,
        dqOnly: false
    };
    state.tableStates.leads.showDQOnly = false;
    state.tableStates.deals.showDQOnly = false;
    state.tableStates.leads.searchTerm = '';
    state.tableStates.deals.searchTerm = '';
    state.tableStates.closers.searchTerm = '';
    notifyListeners();
}

/**
 * Update table state
 */
export function setTableState(table, state_) {
    if (state.tableStates[table]) {
        state.tableStates[table] = { ...state.tableStates[table], ...state_ };
    }
    notifyListeners();
}

/**
 * Update UI state
 */
export function setUIState(ui) {
    state.ui = { ...state.ui, ...ui };
    notifyListeners();
}

/**
 * Update insights
 */
export function setInsights(insights) {
    state.ui.insights = insights;
    notifyListeners();
}

/**
 * Update quality issues
 */
export function setQualityIssues(issues) {
    state.ui.qualityIssues = issues;
    notifyListeners();
}

/**
 * Clear all data
 */
export function clearAllData() {
    const dashboardSettings = state.ui.dashboardSettings || getDefaultDashboardSettings();

    state.rawLeads = null;
    state.rawDeals = null;
    state.leads = null;
    state.deals = null;
    state.leadsMetadata = {
        loaded: false,
        rowCount: 0,
        columns: [],
        issues: []
    };
    state.dealsMetadata = {
        loaded: false,
        rowCount: 0,
        columns: [],
        issues: []
    };
    state.kpiValues = {};
    state.filters = {
        dateStart: null,
        dateEnd: null,
        activeOnly: false,
        leadSource: null,
        dealStatus: null,
        dqOnly: false
    };
    state.tableStates = {
        leads: {
            currentSort: { field: null, direction: 'asc' },
            searchTerm: '',
            showDQOnly: false
        },
        deals: {
            currentSort: { field: null, direction: 'asc' },
            searchTerm: '',
            showDQOnly: false
        },
        closers: {
            currentSort: { field: null, direction: 'desc' },
            searchTerm: ''
        }
    };
    state.ui = {
        currentPage: 'dashboard',
        selectedRow: null,
        insights: [],
        qualityIssues: [],
        lastUpdatedAt: null,
        dashboardSelection: {
            chart: 'funnel',
            kpi: 'deals_total_value'
        },
        dashboardSettings
    };
    notifyListeners();
}

/**
 * Get current state
 */
export function getState() {
    return state;
}

/**
 * Update dashboard settings and save to localStorage
 */
export function updateDashboardSettings(settings) {
    state.ui.dashboardSettings = { ...state.ui.dashboardSettings, ...settings };
    localStorage.setItem('dashboardSettings', JSON.stringify(state.ui.dashboardSettings));
    notifyListeners();
}

/**
 * Load dashboard settings from localStorage
 */
export function loadDashboardSettings() {
    try {
        const saved = localStorage.getItem('dashboardSettings');
        if (saved) {
            const parsed = JSON.parse(saved);

            // Backward compatibility for earlier setting keys
            if (parsed.showKPIs !== undefined && parsed.showKpiSpotlight === undefined) {
                parsed.showKpiSpotlight = parsed.showKPIs;
            }
            if (
                (parsed.showFunnelChart !== undefined || parsed.showRevenueChart !== undefined) &&
                parsed.showChartSpotlight === undefined
            ) {
                parsed.showChartSpotlight = Boolean(parsed.showFunnelChart || parsed.showRevenueChart);
            }
            if (
                (parsed.showInsights !== undefined || parsed.showQuality !== undefined) &&
                parsed.showIntelPanel === undefined
            ) {
                parsed.showIntelPanel = Boolean(parsed.showInsights || parsed.showQuality);
            }

            if (parsed.persistDataLocally === undefined) {
                parsed.persistDataLocally = true;
            }
            if (parsed.autoSyncConnectorOnLoad === undefined) {
                parsed.autoSyncConnectorOnLoad = false;
            }
            if (typeof parsed.hubspotConnectorEndpoint !== 'string') {
                parsed.hubspotConnectorEndpoint = '';
            }

            state.ui.dashboardSettings = { ...state.ui.dashboardSettings, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load dashboard settings:', e);
    }
}
/**
 * Set current page
 */
export function setCurrentPage(page) {
    if (['dashboard', 'kpis', 'charts', 'insights', 'quality', 'deals', 'leads', 'closers', 'settings'].includes(page)) {
        state.ui.currentPage = page;
        notifyListeners();
    }
}
