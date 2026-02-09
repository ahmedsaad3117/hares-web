const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function verify() {
    try {
        console.log('1. Logging in...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            identifier: 'admin@q1key.com',
            password: '123456'
        });

        const token = loginRes.data.access_token;
        console.log('✅ Login successful. Token obtained.');

        console.log('2. Creating active announcement...');
        const announcement = {
            textAr: 'ميزة جديدة: الاشتراكات الآن متاحة',
            textEn: 'New Feature: Subscriptions Now Available',
            isActive: true,
            backgroundColor: '#4f46e5', // Indigo
            textColor: '#ffffff'
        };

        const createRes = await axios.post(`${API_URL}/announcements`, announcement, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Announcement created:', createRes.data);

        console.log('3. Fetching active announcement (Public API)...');
        const activeRes = await axios.get(`${API_URL}/announcements/active`);

        if (activeRes.data && activeRes.data.textEn === 'New Feature: Subscriptions Now Available') {
            console.log('✅ Verification Successful! Active announcement returned correctly.');
            console.log('Data:', activeRes.data);
        } else {
            console.error('❌ Verification Failed: Active announcement mismatch or missing.');
            console.log('Received:', activeRes.data);
        }

    } catch (error) {
        console.error('❌ Error during verification:', error.response ? error.response.data : error.message);
    }
}

verify();
