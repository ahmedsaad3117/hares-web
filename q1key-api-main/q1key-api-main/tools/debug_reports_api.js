const axios = require('axios');

const API_URL = 'http://localhost:3001';
let token = '';

async function login() {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            identifier: 'saad@alamana.com',
            password: '123456'
        });
        token = response.data.access_token;
        console.log('Login successful, token acquired.');
    } catch (error) {
        console.error('Login failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

async function debugReports() {
    await login();

    const filters = {
        // Empty filters to start with, matching the "All Institutions" / "All Branches" default state
    };

    try {
        console.log(' requesting /reports/customers...');
        const res = await axios.get(`${API_URL}/reports/customers`, {
            headers: { Authorization: `Bearer ${token}` },
            params: filters
        });
        console.log('Refreshed data successfully!');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (error) {
        console.error('Reports Error:', error.response?.status, error.response?.statusText);
        console.error('Data:', error.response?.data);
    }
}

debugReports();
