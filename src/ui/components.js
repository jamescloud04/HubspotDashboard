/**
 * UI Components
 * Rendering functions for KPI cards, tables, charts, insights, etc.
 */

import { getKPIDefinition, getKPIsForDependencies } from '../kpis/definitions.js';
import { getKPIDisplayValue } from '../kpis/compute.js';
import { formatCurrency, formatPercent, formatInteger, formatDate } from '../data/parse.js';
import { state } from './state.js';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Render KPI card
 */
export function renderKPICard(kpiId, kpiValue) {
    const definition = getKPIDefinition(kpiId);
    if (!definition) return '';

    const display = getKPIDisplayValue(kpiId, kpiValue);

    return `
        <div class="kpi-card" data-kpi="${kpiId}">
            <div class="kpi-label">${definition.label}</div>
            <div class="kpi-value">${display.text}</div>
            ${display.secondary ? `<div class="kpi-description">${display.secondary}</div>` : ''}
            <div class="kpi-tooltip" title="${definition.tooltip}">
                ℹ️ ${definition.tooltip}
            </div>
        </div>
    `;
}

/**
 * Render all KPI cards
 */
export function renderKPIGrid(kpiValues, hasLeads, hasDeals) {
    if (!kpiValues || Object.keys(kpiValues).length === 0) {
        return '<div class="no-data-msg">Load data files to see KPIs</div>';
    }

    let html = '';
    const ordered = getKPIsForDependencies(hasLeads, hasDeals);
    ordered.forEach(kpi => {
        const value = kpiValues[kpi.id];
        if (value) {
            html += renderKPICard(kpi.id, value);
        }
    });

    return html || '<div class="no-data-msg">No KPIs available</div>';
}

/**
 * Render table header
 */
export function renderTableHeader(columns, sortField, sortDirection) {
    return columns.map(col => {
        let header = col;
        if (col.startsWith('_')) return '';

        // Humanize column name
        header = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        const isSorted = col === sortField;
        const arrow = isSorted ? (sortDirection === 'asc' ? '↑' : '↓') : '';
        const classes = `${isSorted ? `sorted-${sortDirection}` : ''} sortable`;

        return `<th class="${classes}" data-field="${escapeHtml(col)}">${escapeHtml(header)} ${escapeHtml(arrow)}</th>`;
    }).join('');
}

/**
 * Render table row
 */
export function renderTableRow(row, columns, currentTable) {
    const hasIssues = row._derived?.has_quality_issues || (row._issues && row._issues.length > 0);
    const rowClass = hasIssues ? 'dq-warning' : '';

    let htmlRow = `<tr class="${rowClass}" data-row-number="${row._rowNumber}">`;

    columns.forEach(col => {
        if (col.startsWith('_')) return;

        let value = row[col];
        let displayValue = '';

        // Format value
        if (value === null || value === undefined || value === '') {
            displayValue = '—';
        } else if (col.includes('value') || col.includes('paid') || col.includes('amount')) {
            displayValue = formatCurrency(value);
        } else if (col.includes('date')) {
            displayValue = formatDate(value);
        } else if (typeof value === 'boolean') {
            displayValue = value ? '✓' : '✗';
        } else {
            displayValue = String(value).length > 50 ? String(value).substring(0, 47) + '...' : String(value);
        }

        htmlRow += `<td>${escapeHtml(displayValue)}</td>`;
    });

    htmlRow += '</tr>';
    return htmlRow;
}

/**
 * Render full table with data
 */
export function renderTable(data, columns, table, sortField, sortDirection) {
    if (!data || data.length === 0) {
        return '';
    }

    const headerHTML = renderTableHeader(columns, sortField, sortDirection);
    let bodyHTML = '';

    data.forEach(row => {
        bodyHTML += renderTableRow(row, columns, table);
    });

    return { headerHTML, bodyHTML };
}

/**
 * Render insight card
 */
export function renderInsightCard(insight) {
    const typeClass = insight.type || 'default';

    return `
        <div class="insight-card ${typeClass}">
            <div class="insight-title">${insight.title || 'Insight'}</div>
            <div class="insight-text">${insight.text || ''}</div>
            ${insight.metric ? `<span class="insight-metric">${insight.metric}</span>` : ''}
        </div>
    `;
}

/**
 * Render insights container
 */
export function renderInsights(insights) {
    if (!insights || insights.length === 0) {
        return '<div class="no-data-msg">No insights available yet</div>';
    }

    return insights.map(insight => renderInsightCard(insight)).join('');
}

/**
 * Render data quality issue
 */
export function renderQualityIssue(issue) {
    const classes = issue.reason && issue.reason.toLowerCase().includes('error') ? 'error' : '';

    return `
        <div class="quality-item ${classes}">
            <strong>Row ${issue.rowNumber} - ${escapeHtml(issue.field)}</strong>
            <div>${escapeHtml(issue.reason)}</div>
        </div>
    `;
}

/**
 * Render quality issues container
 */
export function renderQualityIssues(issues) {
    if (!issues || issues.length === 0) {
        return '<div style="padding: 1rem; color: var(--secondary);">✓ No quality issues detected</div>';
    }

    const limited = issues.slice(0, 20);
    let html = limited.map(issue => renderQualityIssue(issue)).join('');

    if (issues.length > 20) {
        html += `<div style="padding: 0.75rem; text-align: center; color: var(--secondary);">
            ... and ${issues.length - 20} more issues
        </div>`;
    }

    return html;
}

/**
 * Render detail modal
 */
export function renderDetailModal(row, table) {
    const fields = Object.keys(row).filter(k => !k.startsWith('_'));

    let html = '<div class="detail-grid">';

    fields.forEach(field => {
        const value = row[field];
        let displayValue = '';

        if (value === null || value === undefined || value === '') {
            displayValue = '(empty)';
        } else if (field.includes('value') || field.includes('paid') || field.includes('amount')) {
            displayValue = formatCurrency(value);
        } else if (field.includes('date')) {
            displayValue = formatDate(value);
        } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
        } else {
            displayValue = String(value);
        }

        const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        html += `
            <div class="detail-item">
                <div class="detail-label">${escapeHtml(fieldName)}</div>
                <div class="detail-value">${escapeHtml(displayValue)}</div>
            </div>
        `;
    });

    html += '</div>';

    return html;
}

/**
 * Update upload status in UI
 */
export function updateUploadStatus(leads, deals) {
    const statusEl = document.getElementById('upload-status');
    if (!statusEl) return;

    const parts = [];
    if (leads) parts.push(`Leads: ${leads.length} rows`);
    if (deals) parts.push(`Deals: ${deals.length} rows`);

    let statusText = '';
    if (parts.length === 0) {
        statusText = 'Ready to import data';
    } else {
        statusText = parts.join(' | ') + ` (${new Date().toLocaleTimeString()})`;
    }

    statusEl.textContent = statusText;

}

/**
 * Update file status display
 */
export function updateFileStatus(fileType, status, message) {
    const el = document.getElementById(`${fileType}-status`);
    if (!el) return;

    el.className = `file-status ${status}`;
    el.textContent = message;

    if (status === 'success') {
        setTimeout(() => {
            if (el.className.includes('success')) {
                el.textContent = '✓ Loaded';
            }
        }, 2000);
    }
}

/**
 * Get visible columns for display
 */
export function getVisibleColumns(table, data = null) {
    // If data is provided, get all actual columns from the data
    if (data && data.length > 0) {
        const firstRow = data[0];
        return Object.keys(firstRow).filter(key => !key.startsWith('_'));
    }
    
    // Fallback to comprehensive default lists
    const allFields = table === 'leads' ? 
        ['lead_id', 'first_name', 'last_name', 'email', 'phone', 'company', 'source', 'lead_status', 'lifecycle_stage', 
         'booked_calls', 'first_call_shown', 'first_call_no_show', 'dq_before_call', 'dq_on_call', 'qualified', 'customer', 
         'second_call_booked', 'second_call_shown', 'reschedule_count', 'created_date', 'first_call_date', 'notes',
         'first_call_status', 'rescheduled_call_status', 'second_call_needed', 'second_call_time', 'second_call_status',
         'reschedule_call_time', 'associated_note', 'associated_note_ids'] :
        ['deal_id', 'deal_name', 'contract_value', 'total_paid', 'payment_date', 'contract_start_date', 'contract_end_date',
         'close_date', 'associated_contact', 'notes', 'status', 'active', 'contract_status', 'contract_term', 
         'payment_frequency', 'installment_amount', 'next_payment_date', 'deal_owner'];

    return allFields;
}

/**
 * Build filter controls state
 */
export function buildFilterControls(leads, deals) {
    const sources = new Set();
    const statuses = new Set();

    if (leads && leads.length > 0) {
        leads.forEach(lead => {
            if (lead.source) sources.add(String(lead.source).trim());
        });
    }

    if (deals && deals.length > 0) {
        deals.forEach(deal => {
            if (deal.status) statuses.add(String(deal.status).trim());
        });
    }

    return {
        sources: Array.from(sources).sort(),
        statuses: Array.from(statuses).sort()
    };
}

/**
 * Export data to CSV
 */
export function exportToCSV(data, columns, filename) {
    if (!data || data.length === 0) {
        alert('No data to export');
        return;
    }

    // Build CSV content
    const visibleColumns = columns.filter(c => !c.startsWith('_'));
    const header = visibleColumns.map(col => `"${col}"`).join(',');

    let csv = header + '\n';

    data.forEach(row => {
        const values = visibleColumns.map(col => {
            let value = row[col];
            if (value === null || value === undefined) {
                return '""';
            }
            value = String(value).replace(/"/g, '""');
            return `"${value}"`;
        });
        csv += values.join(',') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename || 'export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Export error report
 */
export function exportErrorReport(issues) {
    if (!issues || issues.length === 0) {
        alert('No issues to export');
        return;
    }

    const header = 'Row Number,Field,Reason\n';
    let csv = header;

    issues.forEach(issue => {
        csv += `${issue.rowNumber},"${issue.field}","${issue.reason}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `error-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
