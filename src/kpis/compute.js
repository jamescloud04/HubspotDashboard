/**
 * KPI Computation Engine
 * Calculates KPI values from normalized datasets
 */

import { getKPIDefinition } from './definitions.js';

/**
 * Compute all KPIs from datasets
 */
export function computeAllKPIs(leads, deals, filters = {}) {
    try {
        const kpiValues = {};

        // Deal KPIs
        if (deals && deals.length > 0) {
            try {
                const filteredDeals = filterDataByType(deals, filters, 'deals');
                
                kpiValues['deals_total_clients'] = computeTotalClients(filteredDeals);
                kpiValues['deals_clients_live'] = computeClientsLive(filteredDeals);
                kpiValues['deals_total_value'] = computeTotalValue(filteredDeals);
                kpiValues['deals_total_collected'] = computeTotalCollected(filteredDeals);
                kpiValues['deals_average_value'] = computeAverageValue(filteredDeals);
                kpiValues['deals_collection_rate'] = computeCollectionRate(filteredDeals);
            } catch (e) {
                console.error('Error computing deal KPIs:', e);
            }
        }

        // Lead KPIs
        if (leads && leads.length > 0) {
            try {
                const filteredLeads = filterDataByType(leads, filters, 'leads');

                kpiValues['leads_total'] = computeLeadsTotal(filteredLeads);
                kpiValues['leads_booked_calls'] = computeBookedCalls(filteredLeads);
                kpiValues['leads_first_call_show_rate'] = computeFirstCallShowRate(filteredLeads);
                kpiValues['leads_dq_rate'] = computeDQRate(filteredLeads);
                kpiValues['leads_dq_before_call'] = computeDQBeforeCall(filteredLeads);
                kpiValues['leads_dq_on_call'] = computeDQOnCall(filteredLeads);
                kpiValues['leads_qualification_rate'] = computeQualificationRate(filteredLeads);
                kpiValues['leads_second_call_show_rate'] = computeSecondCallShowRate(filteredLeads);
                kpiValues['leads_reschedule_count'] = computeRescheduleCount(filteredLeads);
            } catch (e) {
                console.error('Error computing lead KPIs:', e);
            }
        }

        // Cross KPIs (only if both datasets present)
        if (leads && deals && leads.length > 0 && deals.length > 0) {
            try {
                const filteredLeads = filterDataByType(leads, filters, 'leads');
                const filteredDeals = filterDataByType(deals, filters, 'deals');

                kpiValues['cross_close_rate'] = computeCloseRate(filteredLeads, filteredDeals);
                kpiValues['cross_cash_per_lead'] = computeCashPerLead(filteredLeads, filteredDeals);
                kpiValues['cross_contract_value_per_lead'] = computeContractValuePerLead(filteredLeads, filteredDeals);
                kpiValues['cross_cash_per_booked_call'] = computeCashPerBookedCall(filteredLeads, filteredDeals);
            } catch (e) {
                console.error('Error computing cross KPIs:', e);
            }
        }

        return kpiValues;
    } catch (e) {
        console.error('Critical error in KPI computation:', e);
        return {};
    }
}

/**
 * Filter data by type based on global filters
 */
function filterDataByType(data, filters, type) {
    if (!filters || Object.keys(filters).length === 0) {
        return data;
    }

    return data.filter(row => {
        // Active deals filter
        if (type === 'deals' && filters.activeOnly && row._derived?.is_active === false) {
            return false;
        }

        // Lead source filter
        if (type === 'leads' && filters.leadSource && row._derived?.source_normalized !== filters.leadSource) {
            return false;
        }

        // Deal status filter
        if (type === 'deals' && filters.dealStatus && String(row.status || '').trim() !== filters.dealStatus) {
            return false;
        }

        // Date range filter
        let date = null;
        if (type === 'deals' && row._derived?.payment_month) {
            const [year, month] = row._derived.payment_month.split('-');
            date = new Date(year, parseInt(month) - 1, 1);
        } else if (type === 'leads' && row._derived?.created_date) {
            date = row._derived.created_date;
        }

        if (date) {
            if (filters.dateStart && date < new Date(filters.dateStart)) return false;
            if (filters.dateEnd && date > new Date(filters.dateEnd)) return false;
        }

        return true;
    });
}

// Deal KPI Computations

function computeTotalClients(deals) {
    return { value: deals.length, denominator: null, numerator: deals.length };
}

function computeClientsLive(deals) {
    const active = deals.filter(d => d._derived?.is_active === true).length;
    return { value: active, denominator: deals.length, numerator: active };
}

function computeTotalValue(deals) {
    const total = deals.reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
    return { value: total, denominator: null, numerator: total };
}

function computeTotalCollected(deals) {
    const total = deals.reduce((sum, d) => sum + (d._derived?.total_paid_numeric || 0), 0);
    return { value: total, denominator: null, numerator: total };
}

function computeAverageValue(deals) {
    if (deals.length === 0) return { value: 0, denominator: 0, numerator: 0 };
    const total = deals.reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
    return { value: total / deals.length, denominator: deals.length, numerator: total };
}

function computeCollectionRate(deals) {
    const totalValue = deals.reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
    const totalCollected = deals.reduce((sum, d) => sum + (d._derived?.total_paid_numeric || 0), 0);
    
    if (totalValue === 0) return { value: 0, denominator: 0, numerator: 0 };
    const rate = totalCollected / totalValue;
    return { value: rate, denominator: totalValue, numerator: totalCollected };
}

// Lead KPI Computations

function computeLeadsTotal(leads) {
    return { value: leads.length, denominator: null, numerator: leads.length };
}

function computeBookedCalls(leads) {
    const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    return { value: booked, denominator: null, numerator: booked };
}

function computeFirstCallShowRate(leads) {
    const shown = leads.filter(l => l._derived?.first_call_shown === true).length;
    const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    const dqBefore = leads.filter(l => l._derived?.dq_before_call === true).length;
    
    // Denominator: booked - dq_before_call
    const denominator = booked - dqBefore;

    if (denominator <= 0) return { value: 0, denominator: denominator, numerator: shown };
    const rate = shown / denominator;
    return { value: rate, denominator, numerator: shown };
}

function computeDQRate(leads) {
    const dqBefore = leads.filter(l => l._derived?.dq_before_call === true).length;
    const dqOnCall = leads.filter(l => l._derived?.dq_on_call === true).length;
    const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    
    if (booked === 0) return { value: 0, denominator: 0, numerator: dqBefore + dqOnCall };
    const rate = (dqBefore + dqOnCall) / booked;
    return { value: rate, denominator: booked, numerator: dqBefore + dqOnCall };
}

function computeDQBeforeCall(leads) {
    const count = leads.filter(l => l._derived?.dq_before_call === true).length;
    return { value: count, denominator: leads.length, numerator: count };
}

function computeDQOnCall(leads) {
    const count = leads.filter(l => l._derived?.dq_on_call === true).length;
    return { value: count, denominator: leads.length, numerator: count };
}

function computeQualificationRate(leads) {
    const qualified = leads.filter(l => l._derived?.is_qualified === true).length;
    const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    
    if (booked === 0) return { value: 0, denominator: 0, numerator: qualified };
    const rate = qualified / booked;
    return { value: rate, denominator: booked, numerator: qualified };
}

function computeSecondCallShowRate(leads) {
    const shown = leads.filter(l => l._derived?.second_call_shown === true).length;
    const booked = leads.filter(l => l._derived?.second_call_booked === true).length;
    
    if (booked === 0) return { value: 0, denominator: 0, numerator: shown };
    const rate = shown / booked;
    return { value: rate, denominator: booked, numerator: shown };
}

function computeRescheduleCount(leads) {
    const total = leads.reduce((sum, l) => sum + (l._derived?.reschedule_count_num || 0), 0);
    return { value: total, denominator: leads.length, numerator: total };
}

// Cross KPI Computations

function computeCloseRate(leads, deals) {
    const shown = leads.filter(l => l._derived?.first_call_shown === true).length;
    const closed = deals.filter(d => d._derived?.is_closed === true).length;
    
    if (shown === 0) return { value: 0, denominator: 0, numerator: closed };
    const rate = closed / shown;
    return { value: rate, denominator: shown, numerator: closed };
}

function computeCashPerLead(leads, deals) {
    if (leads.length === 0) return { value: 0, denominator: 0, numerator: 0 };
    const totalCash = deals.reduce((sum, d) => sum + (d._derived?.total_paid_numeric || 0), 0);
    return { value: totalCash / leads.length, denominator: leads.length, numerator: totalCash };
}

function computeContractValuePerLead(leads, deals) {
    if (leads.length === 0) return { value: 0, denominator: 0, numerator: 0 };
    const totalValue = deals.reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
    return { value: totalValue / leads.length, denominator: leads.length, numerator: totalValue };
}

function computeCashPerBookedCall(leads, deals) {
    const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    if (booked === 0) return { value: 0, denominator: 0, numerator: 0 };
    const totalCash = deals.reduce((sum, d) => sum + (d._derived?.total_paid_numeric || 0), 0);
    return { value: totalCash / booked, denominator: booked, numerator: totalCash };
}

/**
 * Get KPI display value with proper formatting
 */
export function getKPIDisplayValue(kpiId, computed) {
    if (!computed || computed.value === null || computed.value === undefined) {
        return { text: 'N/A', secondary: '' };
    }

    const kpiDef = getKPIDefinition(kpiId);
    if (!kpiDef) return { text: 'N/A', secondary: '' };

    let text = '';
    let secondary = '';

    const value = computed.value;

    if (kpiDef.formatter === 'currency') {
        text = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    } else if (kpiDef.formatter === 'percent') {
        text = (value * 100).toFixed(1) + '%';
    } else if (kpiDef.formatter === 'integer') {
        text = Math.round(value).toLocaleString();
    } else {
        text = String(value);
    }

    // Add secondary display (numerator / denominator)
    if (computed.denominator !== null && computed.numerator !== null) {
        if (kpiDef.formatter === 'percent') {
            secondary = `${Math.round(computed.numerator)} / ${Math.round(computed.denominator)}`;
        } else if (kpiDef.formatter === 'currency') {
            const formattedNum = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(computed.numerator);
            const formattedDen = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(computed.denominator);
            secondary = `${formattedNum} / ${formattedDen}`;
        } else {
            secondary = `${Math.round(computed.numerator)} / ${Math.round(computed.denominator)}`;
        }
    }

    return { text, secondary };
}
