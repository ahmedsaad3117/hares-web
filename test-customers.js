
async function testCustomers() {
    const loginUrl = 'http://localhost:3001/auth/login';
    const customersUrl = 'http://localhost:3001/customers';

    console.log('--- Testing Login ---');
    try {
        const loginRes = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: 'admin@q1key.com',
                password: 'password123'
            })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', loginRes.status, await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        console.log('Login successful. Token:', loginData.access_token ? 'Received' : 'Missing');

        const token = loginData.access_token;

        console.log('\n--- Testing Customers Fetch ---');
        // Test basic fetch
        const customersRes = await fetch(customersUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!customersRes.ok) {
            console.error('Fetch Customers failed:', customersRes.status, await customersRes.text());
        } else {
            const customersData = await customersRes.json();
            console.log('Fetch Customers successful.');
            console.log('Count:', customersData.data ? customersData.data.length : 'Unknown (data field missing)');
            if (customersData.data && customersData.data.length > 0) {
                console.log('First customer sample:', JSON.stringify(customersData.data[0], null, 2));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testCustomers();
