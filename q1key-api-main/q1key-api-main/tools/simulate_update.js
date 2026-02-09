const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function updatePassword() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            identifier: 'admin@q1key.com',
            password: '123456'
        });

        const token = loginResponse.data.access_token;
        console.log('Login successful. Token obtained.');

        // 2. Update Password
        console.log('Attempting to update password...');
        const userId = 1;
        const payload = {
            oldPassword: '123456',
            password: 'newPassword123'
        };

        const updateResponse = await axios.patch(`${API_URL}/users/${userId}`, payload, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Update Successful!', updateResponse.data);

    } catch (error) {
        console.error('Update Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

updatePassword();
