# HubSpot Analytics Dashboard

## Data Format

### Required Columns

#### Deals CSV
- `deal_id` - Unique deal identifier
- `deal_name` - Deal name or opportunity title
- `contract_value` - Contract value (numeric, can include $,)

#### Leads CSV
- `lead_id` - Unique lead identifier
- `email` - Email address
- `lead_name` - Contact name (or `first_name`/`last_name`)

### Optional Columns

#### Deals
- `status` - Deal status (e.g., "Closed", "Pending")
- `active` - Deal active status (true/false/yes/no)
- `total_paid` - Total payment received
- `payment_date` - Date of last/total payment
- `contract_start_date` - When contract started
- `contract_end_date` - When contract ends
- `close_date` - Deal close date
- `associated_contact` - Email or contact ID for joining
- `notes` - Additional notes

#### Leads
- `source` - Lead source (e.g., "Inbound", "Referral", "Demo")
- `status` - Lead status (e.g., "Booked", "Qualified")
- `booked_calls` - Number of calls booked for lead
- `first_call_shown` - First call attended (true/false)
- `first_call_no_show` - First call no-show (true/false)
- `dq_before_call` - Disqualified before call (true/false)
- `dq_on_call` - Disqualified during call (true/false)
- `qualified` - Lead qualified (true/false)
- `customer` - Became customer (true/false)
- `second_call_booked` - Second call booked (true/false)
- `second_call_shown` - Second call shown (true/false)
- `reschedule_count` - Number of times rescheduled
- `created_date` - When lead was created
- `first_call_date` - Date of first call

### Column Name Aliases

The dashboard is flexible with column naming. Common variations are automatically normalized:

**Deal columns:**
- `deal id`, `dealid`, `id` → `deal_id`
- `deal name`, `name` → `deal_name`
- `contract value`, `value`, `amount`, `deal amount` → `contract_value`
- `deal status`, `stage` → `status`
- `is active`, `active status` → `active`
- `total paid`, `cash collected` → `total_paid`
- And many more...

**Lead columns:**
- `lead id`, `leadid` → `lead_id`
- `lead name`, `full name`, `contact name` → `lead_name`
- `booked calls`, `calls booked` → `booked_calls`
- `first call shown`, `showed first call` → `first_call_shown`
- `lead source`, `where from` → `source`
- And many more...

## KPI Formulas

### Deal KPIs

| KPI | Formula | Notes |
|-----|---------|-------|
| Total Clients Ever | COUNT(deals) | All deals in dataset |
| Clients Live | COUNT(deals WHERE active=true) | Active deals only |
| Total Contract Value | SUM(contract_value) | Sum of all contracts |
| Total Cash Collected | SUM(total_paid) | Sum of all payments |
| Average Sale Value | SUM(contract_value) / COUNT(deals) | Contract value per deal |
| Collection Rate | SUM(total_paid) / SUM(contract_value) | Percentage collected |

### Lead KPIs

| KPI | Formula | Notes |
|-----|---------|-------|
| Total Leads | COUNT(leads) | All leads in dataset |
| Booked Calls | SUM(booked_calls) | Total calls booked |
| 1st Call Show Rate | COUNT(first_call_shown=true) / (SUM(booked_calls) - COUNT(dq_before_call=true)) | **Excludes DQ-before-call from denominator** |
| DQ Rate | (COUNT(dq_before_call) + COUNT(dq_on_call)) / SUM(booked_calls) | Total disqualifications |
| DQ Before Call | COUNT(dq_before_call=true) | Pre-call disqualifications |
| DQ On Call | COUNT(dq_on_call=true) | During-call disqualifications |
| Qualification Rate | COUNT(qualified=true OR customer=true) / SUM(booked_calls) | Qualified prospects |
| 2nd Call Show Rate | COUNT(second_call_shown=true) / COUNT(second_call_booked=true) | If data available |
| Reschedules | SUM(reschedule_count) | Total reschedule counts |

### Cross KPIs (Leads + Deals)

| KPI | Formula | Notes |
|-----|---------|-------|
| Close Rate | COUNT(closed_deals) / COUNT(first_call_shown=true) | % of shown calls that close deals |
| Cash Per Lead | SUM(total_paid) / COUNT(leads) | Average cash per lead |
| Contract Value Per Lead | SUM(contract_value) / COUNT(leads) | Average contract per lead |
| Cash Per Booked Call | SUM(total_paid) / SUM(booked_calls) | Revenue efficiency per call |

## Executive Insights

The dashboard automatically generates insights including:

- **Funnel drop-offs**: Identifies biggest stage losses (show rate, DQ rate, qualification)
- **Revenue concentration**: Warns if top 10% deals represent >60% of revenue
- **Close rate trends**: Flags unusually low (< 20%) or high (> 50%) conversion rates
- **Cash generation**: Shows revenue per lead and per booked call
- **Data quality**: Alerts to high rates of missing/invalid critical fields

## Data Quality Reporting

The dashboard tracks:

- ✓ Missing required columns (deal_id, deal_name, etc.)
- ✓ Missing critical fields in rows (tracks by row number)
- ✓ Invalid data types (e.g., non-numeric contract values)
- ✓ Invalid dates

All issues are downloadable as a CSV report.

## File Structure

```
/src
  /data
    schema.js           # Column definitions & normalization
    parse.js            # CSV parsing & validation
    transforms.js       # Data transformation & derived fields
  /kpis
    definitions.js      # KPI metadata & registry
    compute.js          # KPI calculation engine
    insights.js         # Insight generation
  /ui
    state.js            # Global state management
    components.js       # UI rendering functions
    interactions.js     # Event handlers & user interactions
  /styles
    main.css            # Styling (responsive + print-friendly)
  main.js               # Application bootstrap
/public                 # Static assets
index.html              # Main HTML file
vite.config.js          # Vite configuration
package.json            # Dependencies
```

## Development

### Key Technologies

- **Vite**: Fast build tool and dev server
- **PapaParse**: Robust CSV parsing
- **Chart.js**: Interactive visualizations
- **Vanilla JavaScript**: No framework, lightweight (~50KB gzipped)

### State Management

The app uses a simple centralized state management system:

```javascript
import { state, subscribe, setFilters } from './ui/state.js';

// Subscribe to changes
subscribe((newState) => {
    console.log('State updated:', newState);
});

// Update state
setFilters({ activeOnly: true });
```

### Adding Custom KPIs

1. Add KPI definition to `src/kpis/definitions.js`:
```javascript
export const KPI_REGISTRY = {
    'my_custom_kpi': {
        id: 'my_custom_kpi',
        label: 'My Custom KPI',
        description: 'A custom metric',
        formatter: 'currency',  // or 'percent', 'integer'
        dependencies: ['leads', 'deals'],
        drilldown: { table: 'leads', filter: null }
    }
};
```

### Navigation Model

- The app uses query-based client routes (`?page=upload`, `?page=dashboard`, `?page=charts`, etc.) so each taskbar window is a real client-side page state.
- Browser back/forward works across taskbar windows.
- `Settings` is accessed from the Start menu.

2. Add compute function to `src/kpis/compute.js`:
```javascript
function computeMyCustomKPI(leads, deals) {
    // Your logic here
    return { value: result, denominator: denom, numerator: numer };
}
```

3. Add to `computeAllKPIs()` function in `compute.js`.

### Adding Custom Charts

1. Add chart canvas to `index.html`:
```html
<div class="chart-card">
    <h3>My Chart</h3>
    <canvas id="my-chart"></canvas>
</div>
```

2. Add render function to `src/main.js`:
```javascript
function renderMyChart() {
    const ctx = document.getElementById('my-chart');
    new window.Chart(ctx, {
        type: 'line',
        data: { /* ... */ }
    });
}
```

## Testing

### Unit Tests Examples

Run with: `npm test`

```javascript
// Test KPI calculation
import { computeAllKPIs } from './src/kpis/compute.js';

const leads = [
    { _derived: { booked_calls_count: 10, first_call_shown: true } },
    { _derived: { booked_calls_count: 5, first_call_shown: true } }
];

const kpis = computeAllKPIs(leads, null);
assert(kpis.leads_booked_calls.value === 15);

// Test parsing
import { coerceValue, parseDate } from './src/data/parse.js';

assert(coerceValue('true', 'active') === true);
assert(coerceValue('$1,000', 'contract_value') === 1000);
```

## Browser Compatibility

- ✅ Chrome/Chromium (88+)
- ✅ Firefox (87+)
- ✅ Safari (14+)
- ✅ Edge (88+)
- ❌ IE 11 (not supported)

## Performance

- Handles **5,000+ rows** smoothly
- Chart rendering: < 100ms
- Table sorting/filtering: < 50ms
- KPI computation: < 10ms

## Known Limitations

1. **No backend storage**: Data must be re-uploaded each session (it's not saved)
2. **API import not built-in yet**: Direct HubSpot sync still requires a backend/OAuth flow
3. **No real-time sync**: Changes in source systems require manual re-upload
4. **Joining requires email/contact field**: Cross-KPIs only work if leads and deals share an email or contact ID field
5. **Limited customization**: Insights and thresholds are hardcoded (can be extended)

## Troubleshooting

### "Missing required columns" error
- Check your CSV headers match one of the expected column names (or their aliases)
- Ensure headers are in the first row
- No headers on blank rows

### KPIs showing "N/A"
- Missing optional columns won't cause errors, but related KPIs will show "N/A"
- For example, without `first_call_shown` column, show rate KPIs will be N/A
- Check the data quality report for missing fields

### Charts not displaying
- Ensure Chart.js library loaded (check browser console for errors)
- Try refreshing the page
- Check that your data has the required columns for the chart

### Slow performance
- If you have 10,000+ rows, consider filtering to a subset
- Close other tabs/applications
- Try a different browser

## Security & Privacy

✅ **Your data is completely private**
- Nothing is sent to any server
- No cookies or tracking
- No analytics (unless self-hosted analytics added)
- All processing happens locally in your browser
- You control when data is cleared (Reset button)

## License

MIT License - Feel free to use and modify for your business.

## Support & Contributions

Found a bug? Have a feature request?
- Check existing issues
- Create a detailed bug report with sample data (anonymized)
- Submit pull requests with improvements

## Next Steps

### Potential Enhancements

- [ ] Multi-period comparison (month-over-month growth)
- [ ] Custom metric builder
- [ ] Pipeline forecast modeling
- [ ] Rep/team performance breakdown
- [x] Excel import support (`.csv`, `.xlsx`, `.xls`)
- [ ] Dark mode
- [ ] Mobile app version
- [ ] Historical tracking (localStorage-based)
- [ ] Predictive insights (ML-based anomaly detection)
- [ ] Integration with HubSpot API (OAuth-based production connector)

---

**Made with ❤️ for sales teams that need instant, actionable insights.**
