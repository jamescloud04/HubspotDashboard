import http from 'node:http';

const PORT = process.env.PORT || 3000;

const json = (res, status, payload) => {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(payload));
};

const leads = [
    { lead_id: 'L-1001', lead_name: 'Alice Smith', email: 'alice@example.com', source: 'Referral' },
    { lead_id: 'L-1002', lead_name: 'Brian Lee', email: 'brian@example.com', source: 'Inbound' }
];

const deals = [
    { deal_id: 'D-2001', deal_name: 'Growth Package', contract_value: '12000', total_paid: '8000', status: 'Closed Won' },
    { deal_id: 'D-2002', deal_name: 'Starter Package', contract_value: '6000', total_paid: '2500', status: 'Active' }
];

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        json(res, 204, {});
        return;
    }

    if (req.method === 'GET' && req.url === '/api/hubspot/snapshot') {
        json(res, 200, { leads, deals });
        return;
    }

    json(res, 404, {
        error: 'Not found',
        message: 'Use GET /api/hubspot/snapshot'
    });
});

server.listen(PORT, () => {
    console.log(`HubSpot connector scaffold listening on http://localhost:${PORT}`);
});
