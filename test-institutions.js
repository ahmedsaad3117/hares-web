// using native fetch

async function testInstitutions() {
    const loginUrl = 'http://localhost:3001/auth/login';
    const institutionsUrl = 'http://localhost:3001/institutions';

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
        console.log('User Role:', loginData.user.roleName);

        const token = loginData.access_token;

        console.log('\n--- Searching for admin@example.com ---');
        // Assuming there is a users search endpoint?
        // Let's try /users?search=admin@example.com
        const searchUrl = 'http://localhost:3001/users?search=admin@example.com';
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (searchRes.ok) {
            const searchData = await searchRes.json();
            console.log('Search Result:', JSON.stringify(searchData, null, 2));
        } else {
            console.error('Search failed:', searchRes.status);
        }

        console.log('\n--- Testing Institutions Fetch ---');
        const instRes = await fetch(institutionsUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!instRes.ok) {
            console.error('Fetch Institutions failed:', instRes.status, await instRes.text());
        } else {
            const instData = await instRes.json();
            console.log('Fetch Institutions successful. Count:', instData.data ? instData.data.length : 'Unknown');
        }

        console.log('\n--- Testing Branches Fetch ---');
        const branchesUrl = 'http://localhost:3001/branches';
        const branchRes = await fetch(branchesUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!branchRes.ok) {
            console.error('Fetch Branches failed:', branchRes.status, await branchRes.text());
        } else {
            const branchData = await branchRes.json();
            console.log('Fetch Branches successful. Count:', branchData.data ? branchData.data.length : 'Unknown');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testInstitutions();
