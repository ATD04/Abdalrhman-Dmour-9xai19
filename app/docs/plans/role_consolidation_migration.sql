-- Role Consolidation Migration: 5 roles → 3 roles
-- Migrates from: user, expert, curator, admin, executive
-- To: citizen, operator, admin
-- Date: 2026-04-07

BEGIN;

-- Step 1: Update users table role mapping
-- Map legacy roles to new 3-role system
UPDATE users SET role = CASE
  WHEN role = 'user' THEN 'citizen'
  WHEN role IN ('expert', 'curator') THEN 'operator'
  WHEN role IN ('admin', 'executive') THEN 'admin'
  ELSE 'citizen'  -- Default fallback
END;

-- Step 2: Update audit_log table user_type mapping
-- (if using workflow/governance services)
UPDATE audit_log SET user_type = CASE
  WHEN user_type = 'user' THEN 'citizen'
  WHEN user_type IN ('expert', 'curator') THEN 'operator'
  WHEN user_type IN ('admin', 'executive') THEN 'admin'
  ELSE 'citizen'  -- Default fallback
END
WHERE user_type IN ('user', 'expert', 'curator', 'executive');

-- Step 3: Update cases table user_type and assigned_to fields
UPDATE cases SET user_type = CASE
  WHEN user_type = 'user' THEN 'citizen'
  WHEN user_type IN ('expert', 'curator') THEN 'operator'
  WHEN user_type IN ('admin', 'executive') THEN 'admin'
  ELSE 'citizen'  -- Default fallback
END
WHERE user_type IN ('user', 'expert', 'curator', 'executive');

-- Update assigned_to field if it contains role-based assignments
-- (This assumes assignments are role-based, adjust if they're user-specific)
UPDATE cases SET assigned_to = CASE
  WHEN assigned_to = 'expert' THEN 'operator'
  WHEN assigned_to = 'curator' THEN 'operator'
  WHEN assigned_to = 'executive' THEN 'admin'
  ELSE assigned_to  -- Keep user-specific assignments unchanged
END
WHERE assigned_to IN ('expert', 'curator', 'executive');

-- Step 4: Update sessions table user_type mapping
-- (if using agent service sessions)
UPDATE sessions SET user_type = CASE
  WHEN user_type = 'user' THEN 'citizen'
  WHEN user_type IN ('expert', 'curator') THEN 'operator'
  WHEN user_type IN ('admin', 'executive') THEN 'admin'
  ELSE 'citizen'  -- Default fallback
END
WHERE user_type IN ('user', 'expert', 'curator', 'executive');

-- Step 5: Add constraint to enforce new role values (optional)
-- Uncomment if you want to enforce role constraints at DB level

-- For PostgreSQL:
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role_values;
-- ALTER TABLE users ADD CONSTRAINT check_role_values
--   CHECK (role IN ('citizen', 'operator', 'admin'));

-- For SQLite (if using check constraints):
-- Note: SQLite doesn't support adding constraints to existing tables easily
-- This would require recreating the table

COMMIT;

-- Verification queries to run after migration:
-- SELECT role, COUNT(*) FROM users GROUP BY role;
-- SELECT user_type, COUNT(*) FROM audit_log GROUP BY user_type;
-- SELECT user_type, COUNT(*) FROM cases GROUP BY user_type;
-- SELECT DISTINCT assigned_to FROM cases WHERE assigned_to IS NOT NULL;