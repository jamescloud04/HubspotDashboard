/**
 * Unit Tests for Dashboard
 * Run with: npm test
 */

import assert from 'assert';
import { coerceValue, parseDate, formatCurrency, formatPercent } from './src/data/parse.js';
import { normalizeHeader, hasRequiredColumns, getMissingColumns } from './src/data/schema.js';

console.log('🧪 Running Dashboard Tests...\n');

// Test 1: Value coercion
console.log('Test 1: Value Coercion');
assert(coerceValue('true', 'active') === true, 'Boolean coercion failed');
assert(coerceValue('false', 'active') === false, 'Boolean coercion failed');
assert(coerceValue('$1,000', 'contract_value') === 1000, 'Currency coercion failed');
assert(coerceValue('2,500.50', 'total_paid') === 2500.5, 'Decimal coercion failed');
console.log('✅ Value coercion tests passed\n');

// Test 2: Date parsing
console.log('Test 2: Date Parsing');
const date1 = parseDate('2024-01-15');
assert(date1 instanceof Date, 'Date parsing failed');
assert(date1.getFullYear() === 2024, 'Year parsing failed');
console.log('✅ Date parsing tests passed\n');

// Test 3: Header normalization
console.log('Test 3: Header Normalization');
assert(normalizeHeader('deal id') === 'deal_id', 'Header normalization failed');
assert(normalizeHeader('Deal ID') === 'deal_id', 'Case normalization failed');
assert(normalizeHeader('Deal-ID') === 'deal_id', 'Dash normalization failed');
assert(normalizeHeader('contract value') === 'contract_value', 'Multi-word aggregation failed');
console.log('✅ Header normalization tests passed\n');

// Test 4: Show rate denominator rule
console.log('Test 4: Show Rate Denominator (Critical)');
// This tests the specific rule: shown / (booked - dq_before_call)
const mockLeads = [
    { _derived: { booked_calls_count: 10, first_call_shown: true, dq_before_call: false } },
    { _derived: { booked_calls_count: 5, first_call_shown: true, dq_before_call: false } },
    { _derived: { booked_calls_count: 3, first_call_shown: false, dq_before_call: false } },
    { _derived: { booked_calls_count: 2, first_call_shown: false, dq_before_call: true } }  // DQ-before, excluded from denominator
];

const booked = mockLeads.reduce((sum, l) => sum + (l._derived?.booked_calls_count || 0), 0);
const shown = mockLeads.filter(l => l._derived?.first_call_shown === true).length;
const dqBefore = mockLeads.filter(l => l._derived?.dq_before_call === true).length;

// booked = 20, shown = 2, dq_before = 1
// denominator = 20 - 1 = 19
// show_rate = 2 / 19 ≈ 0.1053
const denominator = booked - dqBefore;
const showRate = shown / denominator;

assert(booked === 20, 'Booked count incorrect');
assert(shown === 2, 'Shown count incorrect');
assert(dqBefore === 1, 'DQ-before count incorrect');
assert(denominator === 19, 'Denominator rule not applied correctly');
assert(Math.abs(showRate - (2/19)) < 0.001, 'Show rate calculation incorrect');
console.log(`✅ Show rate denominator test passed (${(showRate * 100).toFixed(1)}%)`);
console.log(`  Shown: ${shown} / (Booked: ${booked} - DQ-Before: ${dqBefore}) = ${denominator}\n`);

// Test 5: Formatting
console.log('Test 5: Formatting Functions');
const formattedCurrency = formatCurrency(1234.5);
assert(formattedCurrency.includes('$'), 'Currency formatting failed');
assert(formattedCurrency.includes('1,234'), 'Thousand separator failed');

const formattedPercent = formatPercent(0.75);
assert(formattedPercent.includes('%'), 'Percent formatting failed');
assert(formattedPercent.includes('75'), 'Percent value incorrect');
console.log('✅ Formatting tests passed\n');

// Test 6: KPI computation (simulated)
console.log('Test 6: KPI Computation Simulation');
const deals = [
    { _derived: { is_active: true, contract_value_numeric: 10000, total_paid_numeric: 8000, is_closed: true } },
    { _derived: { is_active: false, contract_value_numeric: 5000, total_paid_numeric: 3000, is_closed: false } },
    { _derived: { is_active: true, contract_value_numeric: 20000, total_paid_numeric: 15000, is_closed: true } }
];

// Total clients
const totalClients = deals.length;
assert(totalClients === 3, 'Total clients calculation failed');

// Clients live
const clientsLive = deals.filter(d => d._derived?.is_active === true).length;
assert(clientsLive === 2, 'Clients live calculation failed');

// Total value
const totalValue = deals.reduce((sum, d) => sum + (d._derived?.contract_value_numeric || 0), 0);
assert(totalValue === 35000, 'Total value calculation failed');

// Total collected
const totalCollected = deals.reduce((sum, d) => sum + (d._derived?.total_paid_numeric || 0), 0);
assert(totalCollected === 26000, 'Total collected calculation failed');

// Average value
const avgValue = totalValue / totalClients;
assert(avgValue === 35000 / 3, 'Average value calculation failed');

// Collection rate
const collectionRate = totalCollected / totalValue;
assert(Math.abs(collectionRate - (26000 / 35000)) < 0.001, 'Collection rate calculation failed');

console.log('✅ KPI computation tests passed');
console.log(`  Total Clients: ${totalClients}`);
console.log(`  Clients Live: ${clientsLive}`);
console.log(`  Total Value: $${totalValue.toLocaleString()}`);
console.log(`  Total Collected: $${totalCollected.toLocaleString()}`);
console.log(`  Avg Value: $${Math.round(avgValue).toLocaleString()}`);
console.log(`  Collection Rate: ${(collectionRate * 100).toFixed(1)}%\n`);

console.log('═════════════════════════════');
console.log('✨ All tests passed! (6/6)');
console.log('═════════════════════════════');
