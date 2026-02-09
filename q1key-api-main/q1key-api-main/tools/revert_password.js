const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function revertPassword() {
    try {
        // 1. Login with NEW password
        console.log('Logging in with new password...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            identifier: 'admin@q1key.com',
            password: 'newPassword123'
        });

        const token = loginResponse.data.access_token;
        console.log('Login successful.');

        // 2. Revert Password
        console.log('Reverting password to 123456...');
        const userId = 1;
        const payload = {
            oldPassword: 'newPassword123',
            password: '123456'
        };

        const updateResponse = await axios.patch(`${API_URL}/users/${userId}`, payload, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Revert Successful!', updateResponse.data);

    } catch (error) {
        console.error('Revert Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

revertPassword();
