/**
 * KPI Registry and Definitions
 * Centralized metadata for all KPIs with labels, descriptions, and compute functions
 */

/**
 * KPI Registry
 * Each KPI has: id, label, description, formatter, dependencies, drilldown info
 */
export const KPI_REGISTRY = {
    // Deal KPIs
    'deals_total_clients': {
        id: 'deals_total_clients',
        label: 'Total Clients Ever',
        description: 'Total count of unique deals',
        tooltip: 'Sum of all deals in the dataset',
        formatter: 'integer',
        dependencies: ['deals'],
        drilldown: { table: 'deals', filter: null }
    },
    'deals_clients_live': {
        id: 'deals_clients_live',
        label: 'Clients Live',
        description: 'Count of active deals',
        tooltip: 'Count of deals with active = true',
        formatter: 'integer',
        dependencies: ['deals'],
        drilldown: { table: 'deals', filter: { activeOnly: true } }
    },
    'deals_total_value': {
        id: 'deals_total_value',
        label: 'Total Contract Value',
        description: 'Sum of all contract values',
        tooltip: 'Sum of contract_value field across all deals',
        formatter: 'currency',
        dependencies: ['deals'],
        drilldown: { table: 'deals', filter: null }
    },
    'deals_total_collected': {
        id: 'deals_total_collected',
        label: 'Total Cash Collected',
        description: 'Sum of all payments received',
        tooltip: 'Sum of total_paid field across all deals',
        formatter: 'currency',
        dependencies: ['deals'],
        drilldown: { table: 'deals', filter: null }
    },
    'deals_average_value': {
        id: 'deals_average_value',
        label: 'Average Sale Value',
        description: 'Average contract value per deal',
        tooltip: 'Total Contract Value ÷ Total Clients',
        formatter: 'currency',
        dependencies: ['deals'],
        drilldown: { table: 'deals', filter: null }
    },
    'deals_collection_rate': {
        id: 'deals_collection_rate',
        label: 'Collection Rate',
        description: 'Percentage of value collected vs contracted',
        tooltip: 'Total Cash Collected ÷ Total Contract Value',
        formatter: 'percent',
        dependencies: ['deals'],
        drilldown: { table: 'deals', filter: null }
    },

    // Lead KPIs
    'leads_total': {
        id: 'leads_total',
        label: 'Total Leads',
        description: 'Total count of leads',
        tooltip: 'Sum of all leads in the dataset',
        formatter: 'integer',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_booked_calls': {
        id: 'leads_booked_calls',
        label: 'Booked Calls',
        description: 'Count of leads with booked calls',
        tooltip: 'Sum of booked_calls field (or count of booked=true)',
        formatter: 'integer',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_first_call_show_rate': {
        id: 'leads_first_call_show_rate',
        label: '1st Call Show Rate',
        description: 'Percentage of first calls that were shown',
        tooltip: 'Shown ÷ (Booked - DQ Before Call)',
        formatter: 'percent',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_dq_rate': {
        id: 'leads_dq_rate',
        label: 'DQ Rate',
        description: 'Percentage of leads disqualified',
        tooltip: '(DQ Before + DQ On Call) ÷ Booked Calls',
        formatter: 'percent',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_dq_before_call': {
        id: 'leads_dq_before_call',
        label: 'DQ Before Call',
        description: 'Count of leads disqualified before first call',
        tooltip: 'Count of leads with dq_before_call = true',
        formatter: 'integer',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_dq_on_call': {
        id: 'leads_dq_on_call',
        label: 'DQ On Call',
        description: 'Count of leads disqualified during first call',
        tooltip: 'Count of leads with dq_on_call = true',
        formatter: 'integer',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_qualification_rate': {
        id: 'leads_qualification_rate',
        label: 'Qualification Rate',
        description: 'Percentage of leads qualified',
        tooltip: 'Qualified (SQL or Customer) ÷ Booked Calls',
        formatter: 'percent',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_second_call_show_rate': {
        id: 'leads_second_call_show_rate',
        label: '2nd Call Show Rate',
        description: 'Percentage of second calls that were shown',
        tooltip: 'Shown ÷ Booked (if data available)',
        formatter: 'percent',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },
    'leads_reschedule_count': {
        id: 'leads_reschedule_count',
        label: 'Reschedules',
        description: 'Total number of rescheduled calls',
        tooltip: 'Sum of reschedule_count field',
        formatter: 'integer',
        dependencies: ['leads'],
        drilldown: { table: 'leads', filter: null }
    },

    // Cross KPIs (leads + deals)
    'cross_close_rate': {
        id: 'cross_close_rate',
        label: 'Close Rate',
        description: 'Percentage of shown first calls that closed',
        tooltip: 'Closed Deals ÷ Shown First Calls',
        formatter: 'percent',
        dependencies: ['leads', 'deals'],
        drilldown: { table: 'deals', filter: null }
    },
    'cross_cash_per_lead': {
        id: 'cross_cash_per_lead',
        label: 'Cash Per Lead',
        description: 'Average cash collected per lead',
        tooltip: 'Total Cash Collected ÷ Total Leads',
        formatter: 'currency',
        dependencies: ['leads', 'deals'],
        drilldown: { table: 'leads', filter: null }
    },
    'cross_contract_value_per_lead': {
        id: 'cross_contract_value_per_lead',
        label: 'Contract Value Per Lead',
        description: 'Average contract value per lead',
        tooltip: 'Total Contract Value ÷ Total Leads',
        formatter: 'currency',
        dependencies: ['leads', 'deals'],
        drilldown: { table: 'leads', filter: null }
    },
    'cross_cash_per_booked_call': {
        id: 'cross_cash_per_booked_call',
        label: 'Cash Per Booked Call',
        description: 'Average cash per booked call',
        tooltip: 'Total Cash ÷ Booked Calls',
        formatter: 'currency',
        dependencies: ['leads', 'deals'],
        drilldown: { table: 'leads', filter: null }
    }
};

/**
 * Get all KPIs for a dependency set
 */
export function getKPIsForDependencies(hasLeads, hasDeals) {
    const kpis = [];

    Object.values(KPI_REGISTRY).forEach(kpi => {
        const canCompute = kpi.dependencies.every(dep => {
            if (dep === 'leads') return hasLeads;
            if (dep === 'deals') return hasDeals;
            return true;
        });

        if (canCompute) {
            kpis.push(kpi);
        }
    });

    return kpis;
}

/**
 * Get KPI metadata by ID
 */
export function getKPIDefinition(kpiId) {
    return KPI_REGISTRY[kpiId];
}
