/**
 * Data Schema Definitions
 * Defines required and optional columns for deals and leads datasets
 */

export const REQUIRED_COLUMNS = {
    deals: ['deal_id', 'deal_name', 'contract_value'],
    leads: ['lead_id', 'first_name', 'last_name', 'email']
};

export const OPTIONAL_COLUMNS = {
    deals: [
        'status', 'active', 'total_paid', 'payment_date', 'contract_start_date',
        'contract_end_date', 'close_date', 'associated_contact', 'notes', 'contract_status',
        'contract_term', 'payment_frequency', 'installment_amount', 'next_payment_date', 
        'deal_owner'
    ],
    leads: [
        'email', 'phone', 'company', 'source', 'lead_status', 'lifecycle_stage', 'booked_calls',
        'first_call_shown', 'first_call_no_show', 'dq_before_call', 'dq_on_call',
        'qualified', 'customer', 'second_call_booked', 'second_call_shown',
        'reschedule_count', 'created_date', 'first_call_date', 'notes', 'first_name', 
        'last_name', 'first_call_status', 'rescheduled_call_status', 'second_call_needed',
        'second_call_time', 'second_call_status', 'reschedule_call_time', 'associated_note',
        'associated_note_ids'
    ]
};

/**
 * Header Normalization Rules - Type-specific
 * Maps various header formats to standard internal names
 * Keys are normalized (spaces/dashes replaced with underscores)
 */
export const HEADER_ALIASES_DEALS = {
    'record_id': 'deal_id',
    'deal_id': 'deal_id',
    'dealid': 'deal_id',
    'id': 'deal_id',
    'deal_name': 'deal_name',
    'name': 'deal_name',
    'contract_value': 'contract_value',
    'value': 'contract_value',
    'amount': 'contract_value',
    'deal_amount': 'contract_value',
    'deal_status': 'status',
    'deal_stage': 'status',
    'stage': 'status',
    'is_active': 'active',
    'active_status': 'active',
    'contract_status': 'contract_status',
    'total_paid': 'total_paid',
    'cash_collected': 'total_paid',
    'payment_date': 'payment_date',
    'last_payment_date': 'payment_date',
    'last_payment': 'payment_date',
    'contract_start': 'contract_start_date',
    'contract_start_date': 'contract_start_date',
    'start_date': 'contract_start_date',
    'contract_end': 'contract_end_date',
    'contract_end_date': 'contract_end_date',
    'end_date': 'contract_end_date',
    'close_date': 'close_date',
    'associated_contact': 'associated_contact',
    'contact': 'associated_contact',
    'contract_term': 'contract_term',
    'payment_frequency': 'payment_frequency',
    'installment_amount': 'installment_amount',
    'next_payment_due': 'next_payment_date',
    'next_payment_date': 'next_payment_date',
    'deal_owner': 'deal_owner',
    'owner': 'deal_owner'
};

export const HEADER_ALIASES_LEADS = {
    'record_id': 'lead_id',
    'lead_id': 'lead_id',
    'leadid': 'lead_id',
    'first_name': 'first_name',
    'last_name': 'last_name',
    'lead_name': 'lead_name',
    'full_name': 'lead_name',
    'contact_name': 'lead_name',
    'email': 'email',
    'phone_number': 'phone',
    'phone': 'phone',
    'booked_calls': 'booked_calls',
    'calls_booked': 'booked_calls',
    'first_call_shown': 'first_call_shown',
    'showed_first_call': 'first_call_shown',
    'first_call_no_show': 'first_call_no_show',
    'no_show_first_call': 'first_call_no_show',
    'dq_before_call': 'dq_before_call',
    'disqualified_before_call': 'dq_before_call',
    'dq_on_call': 'dq_on_call',
    'disqualified_on_call': 'dq_on_call',
    'lead_status': 'lead_status',
    'lifecycle_stage': 'lifecycle_stage',
    'contact_source': 'source',
    'lead_source': 'source',
    'source': 'source',
    'where_from': 'source',
    'created_date': 'created_date',
    'create_date': 'created_date',
    'first_call_date': 'first_call_date',
    'meeting_time': 'first_call_date',
    'second_call_booked': 'second_call_booked',
    'second_call_shown': 'second_call_shown',
    'reschedule_count': 'reschedule_count',
    'rescheduled': 'reschedule_count',
    'reschedule_call_time': 'reschedule_call_time',
    'rescheduled_call_status': 'rescheduled_call_status',
    '1st_call_status': 'first_call_status',
    'first_call_status': 'first_call_status',
    '2nd_call_needed': 'second_call_needed',
    'second_call_needed': 'second_call_needed',
    '2nd_call_time': 'second_call_time',
    'second_call_time': 'second_call_time',
    '2nd_call_status': 'second_call_status',
    'second_call_status': 'second_call_status',
    'associated_note': 'associated_note',
    'associated_note_ids': 'associated_note_ids'
};

// Backward compatibility - merge both
export const HEADER_ALIASES = { ...HEADER_ALIASES_DEALS, ...HEADER_ALIASES_LEADS };

/**
 * Normalize a header string to standard format (type-aware)
 */
export function normalizeHeader(header, type = null) {
    // Trim, lowercase, remove special characters except spaces/dashes, then replace spaces/dashes with underscores
    const normalized = header
        .trim()
        .toLowerCase()
        .replace(/[^\w\s\-]/g, '') // Remove special characters except word chars, spaces, and dashes
        .replace(/[\s\-_]+/g, '_'); // Replace spaces, dashes, and multiple underscores with single underscore
    
    // Use type-specific aliases if type provided
    if (type === 'deals') {
        return HEADER_ALIASES_DEALS[normalized] || normalized;
    } else if (type === 'leads') {
        return HEADER_ALIASES_LEADS[normalized] || normalized;
    }
    
    // Fallback to general aliases
    return HEADER_ALIASES[normalized] || normalized;
}

/**
 * Get all expected columns for a dataset type
 */
export function getAllColumns(type) {
    return [...REQUIRED_COLUMNS[type], ...OPTIONAL_COLUMNS[type]];
}

/**
 * Check if a dataset has all required columns
 */
export function hasRequiredColumns(headers, type) {
    const normalizedHeaders = headers.map(h => normalizeHeader(h, type));
    const required = REQUIRED_COLUMNS[type] || [];
    return required.every(col => normalizedHeaders.includes(col));
}

/**
 * Get missing required columns
 */
export function getMissingColumns(headers, type) {
    const normalizedHeaders = headers.map(h => normalizeHeader(h, type));
    const required = REQUIRED_COLUMNS[type] || [];
    return required.filter(col => !normalizedHeaders.includes(col));
}

/**
 * Get available columns from headers
 */
export function getAvailableColumns(headers, type) {
    const normalizedHeaders = headers.map(h => normalizeHeader(h, type));
    const all = getAllColumns(type);
    return normalizedHeaders.filter(h => all.includes(h));
}
