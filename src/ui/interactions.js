/**
 * UI Interactions and Event Handlers
 * Handles user interactions, filtering, table management, drilldowns, etc.
 */

import {
    state,
    setFilters,
    resetFilters,
    setTableState,
    setUIState,
    getState
} from './state.js';
import {
    renderTable,
    renderDetailModal,
    getVisibleColumns,
    buildFilterControls,
    exportToCSV,
    exportErrorReport,
    updateFileStatus
} from './components.js';

// Re-export getVisibleColumns for use in main.js
export { getVisibleColumns };
import { filterDataset, sortDataset, searchDataset } from '../data/transforms.js';
import { computeAllKPIs } from '../kpis/compute.js';
import { generateInsights } from '../kpis/insights.js';

/**
 * Setup all event listeners
 */
export function setupEventListeners(renderFunc) {
    setupTabSwitching(renderFunc);
    setupTableInteractions(renderFunc);
    setupFilterControls(renderFunc);
    setupKPICardClicks(renderFunc);
    setupDetailModal();
}

/**
 * Tab switching
 */
function setupTabSwitching(renderFunc) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const tabName = btn.getAttribute('data-tab');
            const panel = document.getElementById(tabName + '-panel');
            if (panel) {
                panel.classList.add('active');
                setUIState({ activeTab: tabName });
                renderFunc();
            }
        });
    });
}

/**
 * Table interactions (sorting, searching, filtering)
 */
function setupTableInteractions(renderFunc) {
    setupTableSorting(renderFunc);
    setupTableSearch(renderFunc);
    setupTableDQFilter(renderFunc);
    setupTableRowClicks(renderFunc);
    setupTableExport(renderFunc);
}

function setupTableSorting(renderFunc) {
    const tables = ['leads', 'deals'];

    tables.forEach(table => {
        const thead = document.querySelector(`#${table}-thead`);
        if (!thead) return;

        thead.addEventListener('click', (e) => {
            if (e.target.tagName !== 'TH') return;

            const field = e.target.getAttribute('data-field');
            if (!field) return;

            const currentState = state.tableStates[table];
            let newDirection = 'asc';

            if (currentState.currentSort.field === field && currentState.currentSort.direction === 'asc') {
                newDirection = 'desc';
            }

            setTableState(table, {
                currentSort: { field, direction: newDirection }
            });

            renderFunc();
        });
    });
}

function setupTableSearch(renderFunc) {
    const leadsSearch = document.getElementById('leads-search');
    const dealsSearch = document.getElementById('deals-search');

    if (leadsSearch) {
        leadsSearch.addEventListener('input', (e) => {
            setTableState('leads', { searchTerm: e.target.value });
            renderFunc();
        });
    }

    if (dealsSearch) {
        dealsSearch.addEventListener('input', (e) => {
            setTableState('deals', { searchTerm: e.target.value });
            renderFunc();
        });
    }
}

function setupTableDQFilter(renderFunc) {
    const leadsDQ = document.getElementById('leads-dq-filter');
    const dealsDQ = document.getElementById('deals-dq-filter');

    if (leadsDQ) {
        leadsDQ.addEventListener('change', (e) => {
            setTableState('leads', { showDQOnly: e.target.checked });
            renderFunc();
        });
    }

    if (dealsDQ) {
        dealsDQ.addEventListener('change', (e) => {
            setTableState('deals', { showDQOnly: e.target.checked });
            renderFunc();
        });
    }
}

function setupTableRowClicks(renderFunc) {
    const tables = ['leads', 'deals'];

    tables.forEach(table => {
        const tbody = document.querySelector(`#${table}-tbody`);
        if (!tbody) return;

        tbody.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (!row) return;

            const rowNum = row.getAttribute('data-row-number');
            const data = table === 'leads' ? state.leads : state.deals;
            const rowData = data.find(r => r._rowNumber === parseInt(rowNum));

            if (rowData) {
                showDetailModal(rowData, table);
            }
        });
    });
}

function setupTableExport(renderFunc) {
    const leadsExport = document.getElementById('leads-export-btn');
    const dealsExport = document.getElementById('deals-export-btn');

    if (leadsExport) {
        leadsExport.addEventListener('click', () => {
            const filtered = getFilteredTableData('leads');
            const columns = getVisibleColumns('leads');
            exportToCSV(filtered, columns, 'leads-export.csv');
        });
    }

    if (dealsExport) {
        dealsExport.addEventListener('click', () => {
            const filtered = getFilteredTableData('deals');
            const columns = getVisibleColumns('deals');
            exportToCSV(filtered, columns, 'deals-export.csv');
        });
    }
}

/**
 * Filter controls
 */
function setupFilterControls(renderFunc) {
    const dateStartInput = document.getElementById('date-range-start');
    const dateEndInput = document.getElementById('date-range-end');
    const leadSourceFilter = document.getElementById('lead-source-filter');
    const dealStatusFilter = document.getElementById('deal-status-filter');
    const activeOnlyCheckbox = document.getElementById('active-only-filter');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');

    if (dateStartInput) {
        dateStartInput.addEventListener('change', (e) => {
            setFilters({ dateStart: e.target.value || null });
            renderFunc();
        });
    }

    if (dateEndInput) {
        dateEndInput.addEventListener('change', (e) => {
            setFilters({ dateEnd: e.target.value || null });
            renderFunc();
        });
    }

    if (leadSourceFilter) {
        leadSourceFilter.addEventListener('change', (e) => {
            const value = e.target.value || null;
            setFilters({ leadSource: value });
            renderFunc();
        });
    }

    if (dealStatusFilter) {
        dealStatusFilter.addEventListener('change', (e) => {
            const value = e.target.value || null;
            setFilters({ dealStatus: value });
            renderFunc();
        });
    }

    if (activeOnlyCheckbox) {
        activeOnlyCheckbox.addEventListener('change', (e) => {
            setFilters({ activeOnly: e.target.checked });
            renderFunc();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            resetFilters();
            // Clear filter inputs
            if (dateStartInput) dateStartInput.value = '';
            if (dateEndInput) dateEndInput.value = '';
            if (leadSourceFilter) leadSourceFilter.value = '';
            if (dealStatusFilter) dealStatusFilter.value = '';
            if (activeOnlyCheckbox) activeOnlyCheckbox.checked = false;
            renderFunc();
        });
    }
}

/**
 * KPI card clicks for drilldowns
 */
function setupKPICardClicks(renderFunc) {
    const kpiGrid = document.getElementById('kpi-grid');
    if (!kpiGrid) return;

    kpiGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.kpi-card');
        if (!card) return;

        const kpiId = card.getAttribute('data-kpi');
        handleKPIDrilldown(kpiId, renderFunc);
    });
}

function handleKPIDrilldown(kpiId, renderFunc) {
    // Map KPI to relevant table and filters
    const drilldowns = {
        'deals_total_clients': { table: 'deals', filter: null },
        'deals_clients_live': { table: 'deals', filter: 'active' },
        'deals_total_value': { table: 'deals', filter: null },
        'deals_total_collected': { table: 'deals', filter: null },
        'deals_average_value': { table: 'deals', filter: null },
        'deals_collection_rate': { table: 'deals', filter: null },
        'leads_total': { table: 'leads', filter: null },
        'leads_booked_calls': { table: 'leads', filter: null },
        'leads_first_call_show_rate': { table: 'leads', filter: 'shown' },
        'leads_dq_rate': { table: 'leads', filter: 'dq' },
        'leads_qualification_rate': { table: 'leads', filter: 'qualified' },
        'cross_close_rate': { table: 'deals', filter: 'closed' }
    };

    const drilldown = drilldowns[kpiId];
    if (!drilldown) return;

    // Switch to appropriate table
    const tablePanel = document.getElementById(`${drilldown.table}-table-panel`);
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${drilldown.table}-table"]`);

    if (tablePanel && tabBtn) {
        tabBtn.click();
    }

    // Scroll to table
    if (tablePanel) {
        setTimeout(() => {
            tablePanel.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    renderFunc();
}

/**
 * Detail modal
 */
function setupDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;

    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function showDetailModal(rowData, table) {
    const modal = document.getElementById('detail-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    const recordId = table === 'leads' ? rowData.lead_id : rowData.deal_id;
    title.textContent = `${table === 'leads' ? 'Lead' : 'Deal'} Details - ${recordId || 'Unknown'}`;

    body.innerHTML = renderDetailModal(rowData, table);

    modal.style.display = 'flex';
}

/**
 * Get filtered and sorted table data
 */
export function getFilteredTableData(table) {
    let data = table === 'leads' ? state.leads : state.deals;

    if (!data || data.length === 0) {
        return [];
    }

    const tableState = state.tableStates[table];

    // Apply search
    if (tableState.searchTerm) {
        const searchFields = table === 'leads' ? 
            ['lead_id', 'lead_name', 'email', 'source', 'status'] :
            ['deal_id', 'deal_name', 'status', 'associated_contact'];

        data = searchDataset(data, tableState.searchTerm, searchFields);
    }

    // Apply DQ filter
    if (tableState.showDQOnly) {
        data = data.filter(d => d._derived?.has_quality_issues);
    }

    // Apply filters
    data = filterDataset(data, state.filters);

    // Apply sort
    if (tableState.currentSort.field) {
        data = sortDataset(data, tableState.currentSort.field, tableState.currentSort.direction);
    }

    return data;
}

/**
 * Populate filter dropdowns
 */
export function populateFilterControls() {
    const controls = buildFilterControls(state.leads, state.deals);

    // Lead source
    const sourceSelect = document.getElementById('lead-source-filter');
    if (sourceSelect) {
        sourceSelect.innerHTML = '<option value="">All Sources</option>';
        controls.sources.forEach(source => {
            const option = document.createElement('option');
            option.value = source.toLowerCase();
            option.textContent = source;
            sourceSelect.appendChild(option);
        });
        sourceSelect.value = state.filters.leadSource || '';
    }

    // Deal status
    const statusSelect = document.getElementById('deal-status-filter');
    if (statusSelect) {
        statusSelect.innerHTML = '<option value="">All Statuses</option>';
        controls.statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        });
        statusSelect.value = state.filters.dealStatus || '';
    }
}

/**
 * Show a retro notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 * @param {number} duration - Duration in milliseconds (default 3000)
 */
export function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notifications');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        notification.style.animation = 'notificationSlide 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

