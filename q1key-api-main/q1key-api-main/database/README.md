# PostgreSQL Database Setup for Hares Platform

## Prerequisites

Download and install PostgreSQL from:
- **Windows**: https://www.postgresql.org/download/windows/
- **macOS**: https://www.postgresql.org/download/macosx/
- **Linux**: https://www.postgresql.org/download/linux/

## Setup Instructions

### 1. Start PostgreSQL Service

**Windows:**
```bash
# PostgreSQL should start automatically after installation
# Check if running in Services (services.msc)
```

**macOS/Linux:**
```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Or using Homebrew on macOS
brew services start postgresql
```

### 2. Create Database

Open your terminal and run:

```bash
# Connect to PostgreSQL as postgres user
psql -U postgres

# Inside psql prompt:
CREATE DATABASE hares_db;

# Connect to the new database
\c hares_db

# Run the schema file (exit psql first with \q, then run):
```

```bash
# From the api directory, run:
psql -U postgres -d hares_db -f database/schema.sql
```

**Or using pgAdmin:**
1. Open pgAdmin
2. Create new database named `hares_db`
3. Right-click on database → Query Tool
4. Open and execute `api/database/schema.sql`

### 3. Verify Setup

```bash
# Connect to database
psql -U postgres -d hares_db

# List all tables
\dt

# You should see:
# - roles
# - institutions
# - branches
# - users
# - customers
# - products
# - loans
# - activity_log
# - notes

# Check if default data exists
SELECT * FROM roles;
SELECT * FROM users;

# Exit
\q
```

### 4. Update Environment Variables

The `.env` file is already configured for PostgreSQL with default settings:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=hares_db
```

**Update the password** if your PostgreSQL installation uses a different password.

### 5. Start the Application

```bash
# From the root directory
npm run start:dev

# Or from the api directory
cd api
npm run start:dev
```

## Default Credentials

After running the schema, you can log in with:

- **Email**: admin@hares.com
- **Password**: admin123

## Database Schema Overview

### Tables Created:

1. **roles** - User roles (Super Admin, Institution, Branch)
2. **institutions** - Financial institutions
3. **branches** - Institution branches
4. **users** - System users with role-based access
5. **customers** - Loan customers
6. **products** - Loan product templates
7. **loans** - Customer loans
8. **activity_log** - System activity tracking
9. **notes** - Notes attached to entities

### Sample Data Included:

- 3 roles (Super Admin, Institution, Branch)
- 1 Super Admin user
- 1 sample institution
- 1 sample branch
- 2 sample customers
- 3 loan products
- 2 sample loans

## Troubleshooting

### Connection refused
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Or on macOS
brew services list
```

### Authentication failed
```bash
# Reset postgres user password
sudo -u postgres psql
ALTER USER postgres PASSWORD 'your_new_password';
```

### Port already in use
```bash
# Check what's using port 5432
netstat -ano | findstr :5432  # Windows
lsof -i :5432                  # macOS/Linux
```

## Common PostgreSQL Commands

```bash
# Connect to database
psql -U postgres -d hares_db

# List databases
\l

# List tables
\dt

# Describe table
\d table_name

# Exit
\q

# Drop database (careful!)
DROP DATABASE hares_db;
```

## Migration from MySQL

The database has been successfully migrated from MySQL to PostgreSQL with the following changes:

- `AUTO_INCREMENT` → `SERIAL`
- `INT` → `INTEGER`
- `ENUM` → `VARCHAR` with `CHECK` constraint
- `TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` → Separate `updated_at` column
- MySQL-specific indexes converted to PostgreSQL syntax
- `COMMENT` directives removed (PostgreSQL uses different syntax)

All entity files in the NestJS application already use TypeORM decorators that work with both databases.
