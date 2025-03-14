# Database Test Scripts

This directory contains utility scripts for testing and verifying database connections.

## Available Scripts

### table-verification.ts

Checks if all expected tables exist in the Supabase database schema. This script is useful for verifying that database migrations have been applied correctly.

**Usage:**

```bash
npx ts-node src/utils/database-tests/table-verification.ts
```

### supabase-client-test.ts

Tests the direct connection to Supabase using the Supabase JavaScript client. This bypasses Prisma and is useful for isolating connection issues.

**Usage:**

```bash
npx ts-node src/utils/database-tests/supabase-client-test.ts
```

### prisma-supabase-test.ts

Tests the connection to Supabase through the Prisma ORM. This verifies that both Prisma and Supabase are configured correctly.

**Usage:**

```bash
npx ts-node src/utils/database-tests/prisma-supabase-test.ts
```

### simple-connection-test.ts

A basic database connection test. This is a minimal script to verify connectivity.

**Usage:**

```bash
npx ts-node src/utils/database-tests/simple-connection-test.ts
```

## Running These Scripts

All scripts expect your environment variables to be properly configured in the `.env` file. Make sure the following variables are present:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (for Prisma-based tests)
