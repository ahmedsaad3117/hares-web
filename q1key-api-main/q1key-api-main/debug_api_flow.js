const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function testFlow() {
    console.log('1. Attempting Login (Institution Admin)...');
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            identifier: 'ahmed@alamana.com',
            password: '123456'
        });
        console.log('Login Success. Status:', loginRes.status);
        const token = loginRes.data.access_token || loginRes.data.accessToken;
        console.log('User Role:', loginRes.data.user.roleName);
        console.log('Institution ID:', loginRes.data.user.institutionId);

        console.log('7. Fetching CashBox Transactions...');
        try {
            // Simulate exactly what frontend sends: strings from URLSearchParams
            const txRes = await axios.get(`${API_URL}/cash-box/transactions?page=1&limit=20`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('CashBox Tx Status:', txRes.status);
            console.log('CashBox Tx Data Length:', txRes.data.data ? txRes.data.data.length : 'No Data field');
            if (txRes.data.data) console.log('First Tx:', JSON.stringify(txRes.data.data[0]));
        } catch (e) {
            console.error('CashBox Tx Failed:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

        console.log('8. Fetching CashBox Report (undefined dates)...');
        try {
            const reportRes = await axios.get(`${API_URL}/cash-box/report?fromDate=undefined&toDate=undefined`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('CashBox Report Status:', reportRes.status);
        } catch (e) {
            console.error('CashBox Report Failed:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        }

    } catch (error) {
        console.error('Login Failed:', error.response ? error.response.data : error.message);
    }
}

testFlow();
