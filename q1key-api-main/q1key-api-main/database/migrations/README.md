# Database Migrations

## Running Migrations

To apply the migration for institution-based loans:

```bash
# Connect to your PostgreSQL database
psql -U your_username -d hares_db

# Run the migration
\i database/migrations/20250101_add_institution_to_loans.sql
```

## Migration: Add Institution to Loans (20250101)

### Purpose
Allow loans to be associated directly with institutions that don't have branch creation permission (`canCreateBranches = false`). This enables single-institution deployments to function without creating branches.

### Changes
1. Added `institution_id` column to `loans` table
2. Made `branch_id` nullable (optional)
3. Added check constraint ensuring either `branch_id` OR `institution_id` is set (but not both)
4. Added foreign key constraint linking loans to institutions

### Schema Updates
- **Before**: Loans required `branch_id` (NOT NULL)
- **After**: Loans require either `branch_id` OR `institution_id`

### Data Migration
The migration includes a step to backfill `institution_id` for existing loans based on their branch's institution. Review and adjust this step based on your data requirements.

### Rollback
If needed, you can rollback with:

```sql
-- Remove the check constraint
ALTER TABLE loans DROP CONSTRAINT IF EXISTS chk_loans_branch_or_institution;

-- Make branch_id required again (only if no loans have NULL branch_id)
ALTER TABLE loans ALTER COLUMN branch_id SET NOT NULL;

-- Remove institution_id column
ALTER TABLE loans DROP COLUMN institution_id;
```

**Warning**: Only rollback if you haven't created any institution-only loans yet.
