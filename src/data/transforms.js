/**
 * Data Transformations and Derived Fields
 * Computes derived fields and normalizes data types
 */

import { coerceValue, parseDate } from './parse.js';

/**
 * Apply transformations to a dataset
 */
export function transformDataset(rawData, type) {
    if (!rawData || rawData.length === 0) {
        return [];
    }

    try {
        return rawData.map((row, idx) => {
            try {
                return transformRow(row, type);
            } catch (e) {
                console.error(`Error transforming row ${idx}:`, e);
                // Return original row on error
                return row;
            }
        });
    } catch (e) {
        console.error('Error transforming dataset:', e);
        throw new Error(`Data transformation failed: ${e.message}`);
    }
}

/**
 * Transform a single row of data
 */
export function transformRow(row, type) {
    const transformed = { ...row };

    // Combine first_name and last_name into lead_name if needed (for HubSpot CSV structure)
    if (type === 'leads' && !transformed.lead_name && (transformed.first_name || transformed.last_name)) {
        const firstName = transformed.first_name ? String(transformed.first_name).trim() : '';
        const lastName = transformed.last_name ? String(transformed.last_name).trim() : '';
        transformed.lead_name = `${firstName} ${lastName}`.trim();
    }

    // Create deal_name if it doesn't exist (for backward compatibility)
    if (type === 'deals' && !transformed.deal_name && transformed.name) {
        transformed.deal_name = transformed.name;
    }

    // Coerce values to appropriate types
    const keys = Object.keys(transformed);
    for (const key of keys) {
        if (key.startsWith('_')) continue; // Skip internal fields
        try {
            transformed[key] = coerceValue(transformed[key], key);
        } catch (e) {
            console.error(`Error coercing field "${key}":`, e);
            // Keep original value if coercion fails
        }
    }

    // Compute derived fields based on type
    if (type === 'deals') {
        transformed._derived = computeDealDerivedFields(transformed);
    } else if (type === 'leads') {
        transformed._derived = computeLeadDerivedFields(transformed);
    }

    return transformed;
}

/**
 * Compute derived fields for deals
 */
function computeDealDerivedFields(row) {
    const derived = {};

    // Is deal active?
    // Try both old 'active' field and new 'contract_status' field
    let isActive = false;
    if (row.active !== null && row.active !== undefined) {
        isActive = coerceValue(row.active, 'active') === true;
    } else if (row.contract_status) {
        const status = String(row.contract_status).toLowerCase().trim();
        isActive = status === 'active';
    }
    derived.is_active = isActive;

    // Contract value (ensure numeric)
    const contractValue = coerceValue(row.contract_value, 'contract_value');
    derived.contract_value_numeric = typeof contractValue === 'number' ? contractValue : 
                                     (contractValue ? parseFloat(String(contractValue).replace(/[$,]/g, '')) : 0);

    // Total paid (ensure numeric)
    const totalPaid = coerceValue(row.total_paid, 'total_paid');
    derived.total_paid_numeric = typeof totalPaid === 'number' ? totalPaid :
                                 (totalPaid ? parseFloat(String(totalPaid).replace(/[$,]/g, '')) : 0);

    // Installment amount (ensure numeric) - for payment frequency calculations
    const installmentAmount = coerceValue(row.installment_amount, 'installment_amount');
    derived.installment_amount_numeric = typeof installmentAmount === 'number' ? installmentAmount :
                                        (installmentAmount ? parseFloat(String(installmentAmount).replace(/[$,]/g, '')) : 0);

    // Payment frequency (normalized) - for special handling like bi-weekly
    const paymentFreq = row.payment_frequency ? String(row.payment_frequency).toLowerCase().trim() : '';
    derived.payment_frequency_normalized = paymentFreq;

    // Payment month
    const paymentDate = parseDate(row.payment_date);
    derived.payment_month = paymentDate ? 
        `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}` : null;

    // Contract start month
    const startDate = parseDate(row.contract_start_date);
    derived.contract_start_month = startDate ?
        `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}` : null;

    // Is deal closed?
    const dealStatus = row.status ? String(row.status).toLowerCase() : '';
    derived.is_closed = dealStatus.includes('closed');

    // Has quality issues?
    derived.has_quality_issues = row._issues && row._issues.length > 0;

    return derived;
}

/**
 * Compute derived fields for leads
 */
function computeLeadDerivedFields(row) {
    const derived = {};

    // Parse lead status and lifecycle stage to derive boolean fields
    const leadStatus = row.lead_status ? String(row.lead_status).toLowerCase().trim() : '';
    const lifecycleStage = row.lifecycle_stage ? String(row.lifecycle_stage).toLowerCase().trim() : '';

    // Booked calls - determined by lead status
    derived.booked_calls_count = 0;
    derived.first_call_shown = false;
    derived.first_call_no_show = false;
    derived.dq_before_call = false;
    derived.dq_on_call = false;
    derived.second_call_booked = false;

    // Map HubSpot lead status to derived fields
    if (leadStatus.includes('first call booked') || leadStatus.includes('booked')) {
        derived.booked_calls_count = 1;

        // Check actual call outcome from first_call_status field
        const callStatus = row.first_call_status ? String(row.first_call_status).toLowerCase().trim() : '';
        if (callStatus.includes('show')) {
            derived.first_call_shown = true;
        } else if (callStatus.includes('no show')) {
            derived.first_call_no_show = true;
        }
    }
    
    if (leadStatus.includes('dq\'d b4 call') || leadStatus.includes('dq b4 call') || leadStatus.includes("dq'd before")) {
        derived.dq_before_call = true;
        derived.booked_calls_count = 1;
    }
    
    if (leadStatus.includes('dq\'d on call') || leadStatus.includes("dq'd on call")) {
        derived.dq_on_call = true;
        derived.booked_calls_count = 1;
        derived.first_call_shown = true; // They did show up for the call
    }
    
    if (leadStatus.includes('first call completed')) {
        derived.booked_calls_count = 1;
        const callStatus = row.first_call_status ? String(row.first_call_status).toLowerCase().trim() : '';
        if (callStatus.includes('show')) {
            derived.first_call_shown = true;
        }
    }

    if (leadStatus.includes('2nd call booked')) {
        derived.second_call_booked = true;
        derived.booked_calls_count = 1;
        derived.first_call_shown = true; // They made it past first call
    }

    if (leadStatus.includes('closed')) {
        derived.booked_calls_count = 1;
        derived.first_call_shown = true;
    }

    // Account for lifecycle stage
    derived.is_qualified = lifecycleStage.includes('sales qualified') || 
                          lifecycleStage.includes('customer') ||
                          leadStatus.includes('closed');
    
    derived.is_customer = lifecycleStage.includes('customer') || 
                         leadStatus.includes('closed');

    // Second call shown - from second_call_status field
    const secondCallStatus = row.second_call_status ? String(row.second_call_status).toLowerCase().trim() : '';
    derived.second_call_shown = secondCallStatus.includes('show');

    // Reschedule count - from rescheduled_call_status "Rescheduled" or "No Show"
    const rescheduledStatus = row.rescheduled_call_status ? String(row.rescheduled_call_status).toLowerCase().trim() : '';
    derived.reschedule_count_num = rescheduledStatus.includes('rescheduled') ? 1 : 0;
    derived.has_rescheduled = derived.reschedule_count_num > 0;

    // First call date
    derived.first_call_date = parseDate(row.first_call_date) || parseDate(row.meeting_time);

    // Created date
    derived.created_date = parseDate(row.created_date);

    // Lead source (normalized)
    derived.source_normalized = row.source ? String(row.source).trim().toLowerCase() : null;

    // Lead status (normalized)
    derived.status_normalized = leadStatus;

    // Has quality issues?
    derived.has_quality_issues = row._issues && row._issues.length > 0;

    return derived;
}

/**
 * Filter dataset by criteria
 */
export function filterDataset(data, filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return data;
    }

    return data.filter(row => {
        // Date range filter
        if (filters.dateStart || filters.dateEnd) {
            let date = null;
            if (row._derived?.payment_month) {
                const [year, month] = row._derived.payment_month.split('-');
                date = new Date(year, parseInt(month) - 1, 1);
            } else if (row._derived?.created_date) {
                date = row._derived.created_date;
            }

            if (date) {
                if (filters.dateStart && date < new Date(filters.dateStart)) return false;
                if (filters.dateEnd && date > new Date(filters.dateEnd)) return false;
            }
        }

        // Active deals filter
        if (filters.activeOnly && row._derived?.is_active === false) {
            return false;
        }

        // Lead source filter
        if (filters.leadSource && row._derived?.source_normalized !== filters.leadSource) {
            return false;
        }

        // Deal status filter
        if (filters.dealStatus && String(row.status || '').trim() !== filters.dealStatus) {
            return false;
        }

        // Quality issues filter
        if (filters.dqOnly && !row._derived?.has_quality_issues) {
            return false;
        }

        return true;
    });
}

/**
 * Sort dataset by column
 */
export function sortDataset(data, sortField, sortDirection = 'asc') {
    const copy = [...data];

    copy.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];

        // Handle null/undefined
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        // Numeric comparison
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // String comparison
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();

        if (sortDirection === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });

    return copy;
}

/**
 * Group data by a field
 */
export function groupDataByField(data, field) {
    const groups = {};

    data.forEach(row => {
        const value = row[field] || 'unknown';
        const key = String(value).toLowerCase();

        if (!groups[key]) {
            groups[key] = {
                label: value,
                rows: [],
                count: 0
            };
        }

        groups[key].rows.push(row);
        groups[key].count++;
    });

    return groups;
}

/**
 * Extract unique values from a field
 */
export function getUniqueValues(data, field) {
    const seen = new Set();
    const values = [];

    data.forEach(row => {
        const value = row[field];
        if (value && value !== null && value !== undefined) {
            const strValue = String(value).trim();
            if (!seen.has(strValue)) {
                seen.add(strValue);
                values.push(strValue);
            }
        }
    });

    return values.sort();
}

/**
 * Search/filter data by text field
 */
export function searchDataset(data, searchTerm, searchFields = []) {
    if (!searchTerm || !searchTerm.trim()) {
        return data;
    }

    const term = searchTerm.toLowerCase().trim();

    return data.filter(row => {
        return searchFields.some(field => {
            const value = row[field];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(term);
        });
    });
}

/**
 * Join leads and deals on email/contact association
 */
export function joinLeadsAndDeals(leads, deals) {
    const emailToLeads = {};
    const emailToDeals = {};

    // Build email maps
    leads.forEach(lead => {
        const email = lead.email || lead.associated_contact;
        if (email) {
            const key = String(email).toLowerCase();
            if (!emailToLeads[key]) emailToLeads[key] = [];
            emailToLeads[key].push(lead);
        }
    });

    deals.forEach(deal => {
        const email = deal.associated_contact || deal.email;
        if (email) {
            const key = String(email).toLowerCase();
            if (!emailToDeals[key]) emailToDeals[key] = [];
            emailToDeals[key].push(deal);
        }
    });

    return { emailToLeads, emailToDeals };
}
