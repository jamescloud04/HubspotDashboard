/**
 * CSV Parsing and Validation Module
 */

import { normalizeHeader, hasRequiredColumns, getMissingColumns, REQUIRED_COLUMNS } from './schema.js';

export class ParseError {
    constructor(message, context = {}) {
        this.message = message;
        this.context = context;
    }
}

export class DataQualityIssue {
    constructor(rowNumber, field, reason) {
        this.rowNumber = rowNumber;
        this.field = field;
        this.reason = reason;
    }
}

/**
 * Parse CSV file using PapaParse
 * Returns { success, data, errors, stats }
 */
export async function parseCSV(file) {
    return new Promise((resolve) => {
        if (!window.Papa) {
            resolve({
                success: false,
                data: [],
                errors: [new ParseError('PapaParse library not loaded')],
                stats: { totalRows: 0, validRows: 0 }
            });
            return;
        }

        window.Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                const { data, errors: parseErrors } = results;

                if (parseErrors.length > 0) {
                    resolve({
                        success: false,
                        data: [],
                        errors: parseErrors.map(e => new ParseError(e.message, e)),
                        stats: { totalRows: 0, validRows: 0 }
                    });
                    return;
                }

                if (!data || data.length === 0) {
                    resolve({
                        success: false,
                        data: [],
                        errors: [new ParseError('CSV file is empty')],
                        stats: { totalRows: 0, validRows: 0 }
                    });
                    return;
                }

                resolve({
                    success: true,
                    data,
                    errors: [],
                    stats: {
                        totalRows: data.length,
                        validRows: data.length
                    }
                });
            },
            error: (error) => {
                resolve({
                    success: false,
                    data: [],
                    errors: [new ParseError(error.message)],
                    stats: { totalRows: 0, validRows: 0 }
                });
            }
        });
    });
}

/**
 * Validate and normalize dataset
 * Returns { data, issues, stats }
 */
export function validateAndNormalizeDataset(rawData, type) {
    const issues = [];
    let validRows = 0;

    if (!rawData || rawData.length === 0) {
        return {
            data: [],
            issues,
            stats: {
                totalRows: 0,
                validRows: 0,
                issueCount: 0
            }
        };
    }

    // Normalize headers using type-aware normalization
    const originalHeaders = Object.keys(rawData[0]);
    const normalizedHeaders = originalHeaders.map(h => normalizeHeader(h, type));

    // Check required columns
    if (!hasRequiredColumns(originalHeaders, type)) {
        const missing = getMissingColumns(originalHeaders, type);
        return {
            data: [],
            issues: [new DataQualityIssue(0, 'headers', `Missing required columns: ${missing.join(', ')}`)],
            stats: {
                totalRows: rawData.length,
                validRows: 0,
                issueCount: 1
            }
        };
    }

    // Process each row - sanitize to prevent circular references
    const normalizedData = rawData.map((row, rowIndex) => {
        const rowNum = rowIndex + 2; // +2 because row 1 is headers, row index starts at 0
        const normalized = {};
        const rowIssues = [];

        // Normalize field names and values - create clean object without circular refs
        Object.keys(row).forEach((origKey, keyIndex) => {
            if (keyIndex >= normalizedHeaders.length) return; // Skip extra properties
            
            const normalizedKey = normalizedHeaders[keyIndex];
            let value = row[origKey];

            // Skip empty values but track them
            if (value === null || value === undefined || value === '') {
                // Only flag as issue if it's a critical field
                if (isCriticalField(normalizedKey, type)) {
                    rowIssues.push({
                        field: normalizedKey,
                        reason: 'Missing critical field'
                    });
                }
                normalized[normalizedKey] = null;
                return;
            }

            // Ensure value is a safe primitive or convert to string
            try {
                // Check if value is a primitive type
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                    normalized[normalizedKey] = value;
                } else if (value && typeof value === 'object') {
                    // Convert objects to string to avoid circular references
                    normalized[normalizedKey] = String(value);
                } else {
                    normalized[normalizedKey] = String(value);
                }
            } catch (e) {
                console.warn(`Could not process value for ${normalizedKey}:`, e);
                normalized[normalizedKey] = String(value);
            }
        });

        // Store row issues
        rowIssues.forEach(issue => {
            issues.push(new DataQualityIssue(rowNum, issue.field, issue.reason));
        });

        if (rowIssues.length === 0) {
            validRows++;
        }

        normalized._rowNumber = rowNum;
        normalized._issues = rowIssues;
        return normalized;
    });

    return {
        data: normalizedData,
        issues,
        stats: {
            totalRows: rawData.length,
            validRows,
            issueCount: issues.length
        }
    };
}

/**
 * Check if a field is critical (required)
 */
function isCriticalField(field, type) {
    const criticalFields = {
        deals: ['deal_id', 'deal_name', 'contract_value'],
        leads: ['lead_id', 'lead_name', 'email']
    };

    return (criticalFields[type] || []).includes(field);
}

/**
 * Coerce string values to appropriate types
 */
export function coerceValue(value, fieldName) {
    // Guard against circular references and already-coerced values
    if (value === null || value === undefined || value === '') {
        return null;
    }
    
    // If already a Date, return as-is
    if (value instanceof Date) {
        return value;
    }
    
    // If already a number, return as-is  
    if (typeof value === 'number') {
        return value;
    }
    
    // If already a boolean, return as-is
    if (typeof value === 'boolean') {
        return value;
    }

    // Boolean fields
    if (fieldName.includes('active') || fieldName.includes('shown') || fieldName.includes('booked') || 
        fieldName.includes('qualified') || fieldName.includes('customer') || fieldName.includes('needed')) {
        const lower = String(value).toLowerCase().trim();
        if (['true', '1', 'yes', 'y'].includes(lower)) return true;
        if (['false', '0', 'no', 'n'].includes(lower)) return false;
        return value;
    }

    // Numeric fields (currency/amounts)
    if (fieldName.includes('value') || fieldName.includes('contract') || fieldName.includes('paid') || 
        fieldName.includes('amount') || fieldName.includes('count') || fieldName.includes('installment')) {
        const numStr = String(value).replace(/[$,]/g, '').trim();
        const num = parseFloat(numStr);
        return isNaN(num) ? value : num;
    }

    // Date fields
    if (fieldName.includes('date') || fieldName.includes('time')) {
        return parseDate(value);
    }

    return value;
}

/**
 * Parse common date formats
 */
export function parseDate(dateString) {
    if (!dateString) return null;

    const str = String(dateString).trim();
    const date = new Date(str);

    if (isNaN(date.getTime())) {
        // Try alternative formats
        const formats = [
            /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,  // MM/DD/YYYY
            /(\d{4})-(\d{1,2})-(\d{1,2})/,       // YYYY-MM-DD
        ];

        for (const format of formats) {
            const match = str.match(format);
            if (match) {
                // Attempt to parse with matched groups
                try {
                    return new Date(str);
                } catch (e) {
                    continue;
                }
            }
        }

        return null;
    }

    return date;
}

/**
 * Format a date for display
 */
export function formatDate(date) {
    if (!date) return 'N/A';
    if (typeof date === 'string') {
        const parsed = parseDate(date);
        if (!parsed) return date;
        date = parsed;
    }

    if (!(date instanceof Date)) return String(date);
    if (isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format currency
 */
export function formatCurrency(value) {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);
    return (num * 100).toFixed(decimals) + '%';
}

/**
 * Format integer
 */
export function formatInteger(value) {
    if (value === null || value === undefined) return 'N/A';
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    if (isNaN(num)) return String(value);
    return Math.round(num).toLocaleString();
}
