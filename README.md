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
- `deal id`, `dealid`, `id` -> `deal_id`
- `deal name`, `name` -> `deal_name`
- `contract value`, `value`, `amount`, `deal amount` -> `contract_value`
- `deal status`, `stage` -> `status`
- `is active`, `active status` -> `active`
- `total paid`, `cash collected` -> `total_paid`
- And many more...

**Lead columns:**
- `lead id`, `leadid` -> `lead_id`
- `lead name`, `full name`, `contact name` -> `lead_name`
- `booked calls`, `calls booked` -> `booked_calls`
- `first call shown`, `showed first call` -> `first_call_shown`
- `lead source`, `where from` -> `source`
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

- Missing required columns (deal_id, deal_name, etc.)
- Missing critical fields in rows (tracks by row number)
- Invalid data types (e.g., non-numeric contract values)
- Invalid dates

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
