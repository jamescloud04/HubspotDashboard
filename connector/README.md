# HubSpot Connector Scaffold

This folder is an optional backend scaffold for direct HubSpot imports.

Your frontend now supports a connector URL input on the Upload page.  
That URL must return JSON in this shape:

```json
{
  "leads": [{ "lead_id": "1", "email": "lead@example.test", "lead_name": "Sample Lead" }],
  "deals": [{ "deal_id": "d1", "deal_name": "Deal A", "contract_value": "5000" }]
}
```

## Why this exists

- The dashboard stays strictly client-side.
- HubSpot OAuth tokens and private app secrets must stay server-side.
- This connector is the safe bridge for pulling HubSpot data and returning normalized records.

## Quick start (local mock connector)

1. Run:
   - `node connector/server.example.mjs`
2. In the dashboard Upload page, set endpoint to:
   - `http://localhost:3000/api/hubspot/snapshot`
3. Click `Import from HubSpot`.

## Production path

1. Implement OAuth installation and token refresh.
2. Fetch contacts/deals from HubSpot APIs.
3. Normalize fields to your dashboard schema.
4. Return `{ leads, deals }` from `/api/hubspot/snapshot`.
5. Add auth and CORS restrictions.
