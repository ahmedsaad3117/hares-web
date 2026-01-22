# API Testing Guide - Auth & Users

## Prerequisites
1. Ensure database is created and schema is loaded
2. Backend is running on http://localhost:8080

## API Endpoints

### 1. Health Check
```bash
GET http://localhost:8080/api/health
```

### 2. Login (Get JWT Token)
```bash
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "email": "admin@hares.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "userId": 1,
    "name": "System Admin",
    "email": "admin@hares.com",
    "roleId": 1,
    "roleName": "Super Admin"
  }
}
```

### 3. Get Current User Profile
```bash
GET http://localhost:8080/api/users/me
Authorization: Bearer YOUR_JWT_TOKEN
```

### 4. Get All Users (Super Admin Only)
```bash
GET http://localhost:8080/api/users
Authorization: Bearer YOUR_JWT_TOKEN
```

### 5. Create New User (Super Admin Only)
```bash
POST http://localhost:8080/api/users
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "roleId": 2,
  "institutionId": 1,
  "name": "Institution Owner",
  "email": "owner@institution.com",
  "password": "password123",
  "isActive": true
}
```

### 6. Update User (Super Admin Only)
```bash
PATCH http://localhost:8080/api/users/2
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Updated Name",
  "isActive": false
}
```

### 7. Toggle User Active Status (Super Admin Only)
```bash
PATCH http://localhost:8080/api/users/2/toggle-active
Authorization: Bearer YOUR_JWT_TOKEN
```

### 8. Delete User (Super Admin Only)
```bash
DELETE http://localhost:8080/api/users/2
Authorization: Bearer YOUR_JWT_TOKEN
```

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hares.com","password":"admin123"}'
```

### Get Users (replace TOKEN with actual JWT)
```bash
curl -X GET http://localhost:8080/api/users \
  -H "Authorization: Bearer TOKEN"
```

## Testing with PowerShell

### Login
```powershell
$body = @{
    email = "admin@hares.com"
    password = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $body -ContentType "application/json"
$token = $response.access_token
Write-Host "Token: $token"
```

### Get Users
```powershell
$headers = @{
    Authorization = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:8080/api/users" -Method Get -Headers $headers
```

## Role-Based Access

- **Super Admin**: Full access to all endpoints
- **Institution**: Can view specific user details
- **Branch**: Limited access (to be implemented in next modules)

## Common Response Codes

- `200` - Success
- `201` - Created
- `204` - No Content (successful deletion)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate email)

## Next Steps

After testing Auth & Users, we'll implement:
1. Institutions module
2. Branches module
3. Customers module
4. Loans module
5. Activity Log
6. Notes system
