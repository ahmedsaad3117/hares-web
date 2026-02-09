const fs = require('fs');
async function test() {
    const ts = Date.now();
    const payload = {
        name: 'مؤسسة بدون أزرار ' + ts,
        taxId: 'T' + ts,
        phoneNumber: '0501234567',
        email: 'test' + ts + '@example.com',
        adminName: 'مدير النظام',
        adminEmail: 'admin' + ts + '@example.com',
        adminPassword: 'password123',
        adminPhoneNumber: '0501234567',
        adminNationalId: 'ID' + ts,
        planId: 1
    };
    try {
        const res = await fetch('http://127.0.0.1:3001/api/institutions/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const status = res.status;
        const data = await res.json();
        const result = { status, data, payload };
        fs.writeFileSync('test_registration_result.json', JSON.stringify(result, null, 2));
        console.log('Done with status:', status);
    } catch (e) {
        fs.writeFileSync('test_registration_result.json', JSON.stringify({ error: e.message }, null, 2));
        console.error('Error:', e.message);
    }
}
test();
