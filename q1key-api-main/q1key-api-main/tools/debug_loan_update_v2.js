const axios = require('axios');

const API_URL = 'http://localhost:3000';
let token = '';

async function login() {
    try {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email: 'saad@alamana.com',
            password: '123456'
        });
        token = response.data.accessToken;
        console.log('Login successful');
    } catch (error) {
        console.error('Login failed:', error.response?.data || error.message);
        process.exit(1);
    }
}

async function runTest() {
    await login();

    // 1. Create a Loan (3 months)
    console.log('Creating loan with 3 months plan...');
    let loanId;
    try {
        // Need a customer and product first. Assuming typical IDs exist or fetch them.
        // Fetch a customer
        const customers = await axios.get(`${API_URL}/customers`, { headers: { Authorization: `Bearer ${token}` } });
        const customerId = customers.data.data[0].customerId;

        const products = await axios.get(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } });
        const productId = products.data[0].productId;

        const createRes = await axios.post(`${API_URL}/loans`, {
            customerId,
            productId,
            principalAmount: 3000,
            paymentPlanMonths: 3,
            dueDate: new Date().toISOString().split('T')[0],
            branchId: 1 // Saad is branch 1
        }, { headers: { Authorization: `Bearer ${token}` } });

        loanId = createRes.data.loanId;
        console.log(`Loan created: ${loanId}. Installments:`, createRes.data.installments.length);

        if (createRes.data.installments.length !== 3) {
            console.error('ERROR: Initial installments count is wrong!');
        }

    } catch (error) {
        console.error('Create loan failed:', error.response?.data || error.message);
        return;
    }

    // 2. Update Loan to 4 months
    console.log('Updating loan to 4 months...');
    try {
        const updateRes = await axios.patch(`${API_URL}/loans/${loanId}`, {
            principalAmount: 3000, // Same amount
            paymentPlanMonths: 4,
            dueDate: new Date().toISOString().split('T')[0],
            status: 'Active'
        }, { headers: { Authorization: `Bearer ${token}` } });

        console.log('Update response loans plan:', updateRes.data.paymentPlanMonths);

        // Fetch fresh loan data to verify installments
        const getRes = await axios.get(`${API_URL}/loans/${loanId}`, { headers: { Authorization: `Bearer ${token}` } });
        const installments = getRes.data.installments;

        console.log(`Loan ${loanId} Installments count: ${installments.length}`);
        installments.forEach(i => console.log(`- #${i.installmentNumber}: ${i.amount} (Due: ${i.dueDate})`));

        if (installments.length === 4) {
            console.log('SUCCESS: Loan updated to 4 installments.');
        } else {
            console.error('FAILURE: Installment count is incorrect.');
        }

    } catch (error) {
        console.error('Update loan failed:', error.response?.data || error.message);
    }
}

runTest();
