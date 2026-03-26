/**
 * Insights Generation
 * Analyzes data to generate meaningful business insights
 */

import { computeAllKPIs } from './compute.js';

/**
 * Generate insights from datasets
 */
export function generateInsights(leads, deals, kpiValues) {
    const insights = [];

    if (!leads && !deals) {
        return insights;
    }

    // Lead funnel insights
    if (leads && leads.length > 0) {
        insights.push(...generateLeadFunnelInsights(leads, kpiValues));
    }

    // Deal insights
    if (deals && deals.length > 0) {
        insights.push(...generateDealInsights(deals, kpiValues));
    }

    // Cross insights
    if (leads && deals && leads.length > 0 && deals.length > 0) {
        insights.push(...generateCrossInsights(leads, deals, kpiValues));
    }

    // Data quality insights
    if (leads || deals) {
        insights.push(...generateDataQualityInsights(leads, deals));
    }

    return insights;
}

function generateLeadFunnelInsights(leads, kpiValues) {
    const insights = [];
    const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
    const shown = leads.filter(l => l._derived?.first_call_shown === true).length;
    const dqBefore = leads.filter(l => l._derived?.dq_before_call === true).length;
    const dqOnCall = leads.filter(l => l._derived?.dq_on_call === true).length;
    const qualified = leads.filter(l => l._derived?.is_qualified === true).length;

    // Biggest funnel drop-off
    const showRate = kpiValues['leads_first_call_show_rate'];
    if (showRate && showRate.value < 0.5 && booked > 0) {
        insights.push({
            type: 'warning',
            title: 'Low First Call Show Rate',
            text: `Only ${(showRate.value * 100).toFixed(1)}% of eligible leads showed for their first call. This is a significant drop-off point.`,
            metric: `${(showRate.value * 100).toFixed(1)}%`
        });
    }

    // High DQ rate
    const dqRate = kpiValues['leads_dq_rate'];
    if (dqRate && dqRate.value > 0.3 && booked > 0) {
        insights.push({
            type: 'danger',
            title: 'High Disqualification Rate',
            text: `${(dqRate.value * 100).toFixed(1)}% of booked calls result in disqualification.`,
            metric: `${Math.round(dqBefore + dqOnCall)} / ${booked}`
        });
    }

    // Low qualification rate
    const qualRate = kpiValues['leads_qualification_rate'];
    if (qualRate && qualRate.value < 0.3 && booked > 0) {
        insights.push({
            type: 'warning',
            title: 'Low Qualification Rate',
            text: `Only ${(qualRate.value * 100).toFixed(1)}% of booked calls result in qualified prospects.`,
            metric: `${qualified} / ${booked}`
        });
    }

    // Positive: High show rate
    if (showRate && showRate.value > 0.8) {
        insights.push({
            type: 'success',
            title: 'Excellent First Call Show Rate',
            text: `${(showRate.value * 100).toFixed(1)}% of booked calls are attended.`,
            metric: `${(showRate.value * 100).toFixed(1)}%`
        });
    }

    return insights;
}

function generateDealInsights(deals, kpiValues) {
    const insights = [];

    // Collection rate insight
    const collectionRate = kpiValues['deals_collection_rate'];
    if (collectionRate && collectionRate.value < 0.8) {
        insights.push({
            type: 'warning',
            title: 'Collection Gap',
            text: `${(collectionRate.value * 100).toFixed(1)}% of contracted value has been collected. ${((1 - collectionRate.value) * 100).toFixed(1)}% remains outstanding.`,
            metric: `${(collectionRate.value * 100).toFixed(1)}%`
        });
    }

    // Revenue concentration
    const totalValue = deals.reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
    if (totalValue > 0) {
        const sortedDeals = [...deals].sort((a, b) => 
            (b._derived?.contract_value_numeric || 0) - (a._derived?.contract_value_numeric || 0)
        );
        const top10Pct = Math.ceil(deals.length * 0.1);
        const top10Value = sortedDeals.slice(0, top10Pct)
            .reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
        const concentration = top10Value / totalValue;

        if (concentration > 0.6) {
            insights.push({
                type: 'warning',
                title: 'Revenue Concentration Risk',
                text: `Top 10% of deals represent ${(concentration * 100).toFixed(1)}% of total revenue.`,
                metric: `${(concentration * 100).toFixed(1)}%`
            });
        }
    }

    // Average deal value
    const avgValue = kpiValues['deals_average_value'];
    if (avgValue && avgValue.value > 0) {
        const highValue = deals.filter(d => (d._derived?.contract_value_numeric || 0) > avgValue.value * 2).length;
        if (highValue > 0) {
            insights.push({
                type: 'success',
                title: 'Premium Deals Present',
                text: `${highValue} deals exceed 2x the average deal value.`,
                metric: `${highValue} deals`
            });
        }
    }

    return insights;
}

function generateCrossInsights(leads, deals, kpiValues) {
    const insights = [];

    // Close rate
    const closeRate = kpiValues['cross_close_rate'];
    if (closeRate && closeRate.value > 0) {
        if (closeRate.value > 0.5) {
            insights.push({
                type: 'success',
                title: 'Strong Close Rate',
                text: `${(closeRate.value * 100).toFixed(1)}% of shown first calls result in closed deals.`,
                metric: `${(closeRate.value * 100).toFixed(1)}%`
            });
        } else if (closeRate.value < 0.2) {
            insights.push({
                type: 'danger',
                title: 'Low Close Rate',
                text: `Only ${(closeRate.value * 100).toFixed(1)}% of shown first calls result in closed deals.`,
                metric: `${(closeRate.value * 100).toFixed(1)}%`
            });
        }
    }

    // Cash per lead
    const cashPerLead = kpiValues['cross_cash_per_lead'];
    if (cashPerLead && cashPerLead.value > 0) {
        const totalLeads = leads.length;
        const estimatedMonthlyRecurring = cashPerLead.value * totalLeads * 12;
        if (estimatedMonthlyRecurring > 0) {
            const monthlyValue = Math.round(estimatedMonthlyRecurring / 12);
            insights.push({
                type: 'success',
                title: 'Cash Generation Per Lead',
                text: `Each lead generates an average of $${Math.round(cashPerLead.value).toLocaleString()} in collected revenue.`,
                metric: `$${Math.round(cashPerLead.value).toLocaleString()} / lead`
            });
        }
    }

    return insights;
}

function generateDataQualityInsights(leads, deals) {
    const insights = [];

    let totalIssues = 0;
    let totalRows = 0;

    if (leads && leads.length > 0) {
        const leadIssues = leads.filter(l => l._derived?.has_quality_issues).length;
        totalIssues += leadIssues;
        totalRows += leads.length;

        if (leadIssues > 0) {
            const issueRate = leadIssues / leads.length;
            if (issueRate > 0.1) {
                insights.push({
                    type: 'warning',
                    title: 'Lead Data Quality Issues',
                    text: `${(issueRate * 100).toFixed(1)}% of leads have missing or invalid critical fields.`,
                    metric: `${leadIssues} / ${leads.length}`
                });
            }
        }
    }

    if (deals && deals.length > 0) {
        const dealIssues = deals.filter(d => d._derived?.has_quality_issues).length;
        totalIssues += dealIssues;
        totalRows += deals.length;

        if (dealIssues > 0) {
            const issueRate = dealIssues / deals.length;
            if (issueRate > 0.1) {
                insights.push({
                    type: 'warning',
                    title: 'Deal Data Quality Issues',
                    text: `${(issueRate * 100).toFixed(1)}% of deals have missing or invalid critical fields.`,
                    metric: `${dealIssues} / ${deals.length}`
                });
            }
        }
    }

    return insights;
}

/**
 * Get anomalies based on data quality thresholds
 */
export function detectAnomalies(leads, deals) {
    const anomalies = [];
    const THRESHOLD_CONFIG = {
        minShowRate: 0.5,
        maxDQRate: 0.3,
        minCloseRate: 0.2,
        minCollectionRate: 0.8,
        maxRevenueConcentration: 0.6
    };

    // Check if show rate is unusually low
    if (leads && leads.length > 0) {
        const shown = leads.filter(l => l._derived?.first_call_shown === true).length;
        const booked = leads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
        const dqBefore = leads.filter(l => l._derived?.dq_before_call === true).length;
        const denominator = booked - dqBefore;
        
        if (denominator > 0) {
            const showRate = shown / denominator;
            if (showRate < THRESHOLD_CONFIG.minShowRate) {
                anomalies.push({
                    type: 'anomaly',
                    description: 'Show rate falling below threshold',
                    threshold: THRESHOLD_CONFIG.minShowRate,
                    actual: showRate
                });
            }
        }
    }

    // Check if collection rate is unusually low
    if (deals && deals.length > 0) {
        const totalValue = deals.reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
        const totalCollected = deals.reduce((sum, d) => sum + (d._derived?.total_paid_numeric || 0), 0);
        
        if (totalValue > 0) {
            const collectionRate = totalCollected / totalValue;
            if (collectionRate < THRESHOLD_CONFIG.minCollectionRate) {
                anomalies.push({
                    type: 'anomaly',
                    description: 'Collection rate falling below threshold',
                    threshold: THRESHOLD_CONFIG.minCollectionRate,
                    actual: collectionRate
                });
            }
        }
    }

    return anomalies;
}

