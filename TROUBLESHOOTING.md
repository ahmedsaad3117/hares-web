# 🔧 Troubleshooting Guide - Login & Redirect Issues

## ✅ Changes Made

### Fixed Issues:
1. **Redirect paths** - Changed from absolute `/web/index.html` to relative `../index.html`
2. **Backend console log** - Removed incorrect `/api` suffix
3. **Added debugging** - Console logs to track authentication flow

---

## 🧪 Testing Steps

### 1. Clear Everything First
```javascript
// Open browser console (F12) and run:
localStorage.clear();
location.reload();
```

### 2. Start Backend
```powershell
cd api
npm run start:dev
# Should show: 🚀 Hares Platform API is running on: http://localhost:3001
```

### 3. Start Frontend
```powershell
# In project root (C:\Users\ahmed\hares)
python -m http.server 8080
```

### 4. Test System Check
Open: http://localhost:8080/web/system-check.html
- API Connection should show ✓ Connected
- LocalStorage should show ✓ Available

### 5. Test Login
1. Open: http://localhost:8080/web/
2. Open Browser Console (F12)
3. Login with:
   - Email: `admin@example.com`
   - Password: `password123`

4. **Watch Console Output:**
   ```
   Login successful: {access_token: "...", user: {...}}
   Auth data saved. Token: eyJhbGc...
   User: {userId: 1, name: "...", ...}
   ```

5. Should redirect to dashboard
6. **Dashboard Console Should Show:**
   ```
   Dashboard loading...
   Token: eyJhbGc...
   User: {userId: 1, ...}
   Authentication passed!
   ```

---

## 🐛 Common Issues & Fixes

### Issue 1: Infinite Redirect Loop
**Symptoms:** Page keeps reloading
**Cause:** Token not being saved properly
**Fix:**
1. Clear localStorage: `localStorage.clear()`
2. Check Network tab - does login return `access_token`?
3. Check if token is saved: `localStorage.getItem('token')`

### Issue 2: CORS Error
**Symptoms:** Console shows "CORS policy" error
**Fix:**
- Backend has `enableCors({ origin: '*' })` 
- Make sure API is running on port 3001
- Try restarting backend

### Issue 3: 401 Unauthorized on Dashboard
**Symptoms:** Dashboard redirects back to login
**Cause:** Token not being sent or invalid
**Fix:**
1. Check if token exists: `localStorage.getItem('token')`
2. Check Network tab - Authorization header should have `Bearer <token>`
3. Check if backend accepted the token

### Issue 4: API Not Responding
**Symptoms:** Login button stays spinning
**Check:**
```powershell
# Test API directly
curl http://localhost:3001/auth/login
# Should return: "Cannot GET /auth/login" (POST expected)

# Or in browser console:
fetch('http://localhost:3001/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email:'admin@example.com', password:'password123'})
}).then(r=>r.json()).then(console.log)
```

---

## 📝 Debug Checklist

When login redirects, check console for:

✅ **On Login Page:**
- [ ] "Login successful" message appears
- [ ] Token is displayed (first 20 chars)
- [ ] User object is displayed
- [ ] No errors in console

✅ **On Dashboard:**
- [ ] "Dashboard loading..." appears
- [ ] Token is displayed
- [ ] User object is displayed
- [ ] "Authentication passed!" appears
- [ ] No "Not authenticated" message

✅ **Network Tab:**
- [ ] POST to `/auth/login` returns 200
- [ ] Response has `access_token` and `user`
- [ ] Subsequent requests have `Authorization: Bearer ...` header

✅ **localStorage:**
```javascript
// Check in console:
localStorage.getItem('token')  // Should show JWT token
localStorage.getItem('user')   // Should show user JSON
```

---

## 🔍 Manual Debugging

If it still doesn't work, add this to login page after line 80:

```javascript
console.log('=== LOGIN DEBUG ===');
console.log('Email:', email);
console.log('Password length:', password.length);
console.log('API_BASE_URL:', API_BASE_URL);

// After response:
console.log('Response:', response);
console.log('Access Token:', response.access_token?.substring(0, 30) + '...');
console.log('User:', response.user);

// After saving:
console.log('Saved token:', localStorage.getItem('token')?.substring(0, 30) + '...');
console.log('Saved user:', localStorage.getItem('user'));
```

---

## 🎯 Expected Flow

1. **Login Page** → Enter credentials → Click Sign In
2. **API Call** → POST /auth/login → Returns token + user
3. **Save to localStorage** → token + user saved
4. **Redirect** → window.location.href = 'pages/dashboard.html'
5. **Dashboard Loads** → Checks localStorage for token
6. **Auth Check Passes** → Renders sidebar, header, stats
7. **API Calls** → All requests include Authorization header

---

## 💡 Quick Test Script

Add this to browser console on dashboard to test everything:

```javascript
// Test Authentication
console.log('=== AUTH TEST ===');
console.log('Token exists:', !!localStorage.getItem('token'));
console.log('User exists:', !!localStorage.getItem('user'));
console.log('isAuthenticated:', isAuthenticated());

// Test API Call
api.customers.getAll()
  .then(data => console.log('✓ API working:', data.length, 'customers'))
  .catch(err => console.error('✗ API failed:', err.message));
```

---

## 📞 Still Having Issues?

Check these files for the exact debugging output:
- Open: http://localhost:8080/web/
- Login and check browser console (F12)
- Take a screenshot of console output
- Check Network tab for failed requests

The console logs will show exactly where the problem is!
