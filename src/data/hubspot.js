/**
 * HubSpot connector import helper.
 * Expects a backend endpoint that returns JSON:
 * { leads: Array<object>, deals: Array<object> }
 */

export async function importFromHubSpotConnector(endpointUrl) {
    const endpoint = String(endpointUrl || '').trim();
    if (!endpoint) {
        throw new Error('HubSpot connector endpoint is required');
    }

    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Connector request failed (${response.status})`);
    }

    const payload = await response.json();
    const leads = Array.isArray(payload?.leads) ? payload.leads : [];
    const deals = Array.isArray(payload?.deals) ? payload.deals : [];

    if (leads.length === 0 && deals.length === 0) {
        throw new Error('Connector returned no leads or deals');
    }

    return { leads, deals };
}
