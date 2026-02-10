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
        currentPage: 'dashboard',  // 'upload', 'dashboard', 'charts', 'insights', 'quality', 'deals', 'leads', or 'closers'
        selectedRow: null,
        insights: [],
        qualityIssues: [],
        // Dashboard customization
        dashboardSettings: {
            showKPIs: true,
            showFunnelChart: true,
            showRevenueChart: true,
            showInsights: true,
            showQuality: true,
            compactMode: true
        }
    }
};

// Event listeners for state changes
const listeners = new Set();

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
    listeners.forEach(callback => callback(state));
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
        qualityIssues: []
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
            state.ui.dashboardSettings = { ...state.ui.dashboardSettings, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('Failed to load dashboard settings:', e);
    }
}
/**
 * Set current page
 */
export function setCurrentPage(page) {
    if (['upload', 'dashboard', 'charts', 'insights', 'quality', 'deals', 'leads', 'closers', 'settings'].includes(page)) {
        state.ui.currentPage = page;
        notifyListeners();
    }
}