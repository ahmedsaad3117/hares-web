const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/Users/MARWAN/Desktop/q1key/q1key-api-main/q1key-api-main/q1key.db');

db.all("SELECT count(*) as count FROM subscription_requests", [], (err, rows) => {
  if (err) {
    console.error(err.message);
    return;
  }
  console.log('Total Requests:', rows[0].count);
  
  db.all("SELECT status, count(*) as count FROM subscription_requests GROUP BY status", [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return;
    }
    console.log('Requests by Status:', rows);
    db.close();
  });
});
