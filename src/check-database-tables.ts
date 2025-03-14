// Script to check existing tables in the Supabase database
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

// Use service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAllUsers() {
  try {
    console.log('Fetching users from auth system...');
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      console.log(`Total users: ${data.users.length}`);
      if (data.users.length > 0) {
        data.users.forEach((user, index) => {
          console.log(`User ${index + 1}: ${user.email}`);
        });
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

async function checkTable(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select('*').limit(1);

    if (error && error.code === '42P01') {
      // Table doesn't exist error
      console.log(`❌ Table '${tableName}' does not exist`);
      return false;
    } else if (error) {
      console.log(`⚠️ Error checking table '${tableName}':`, error);
      return false;
    } else {
      console.log(`✅ Table '${tableName}' exists`);
      return true;
    }
  } catch (error) {
    console.log(`⚠️ Unexpected error checking table '${tableName}':`, error);
    return false;
  }
}

async function main() {
  await listAllUsers();

  console.log('\nChecking for tables from our Prisma schema:');

  // List of tables we expect based on our Prisma schema
  const expectedTables = [
    'programs',
    'courses',
    'sessions',
    'students',
    'registrars',
    'enrollments',
    'program_courses',
    'session_courses',
    'invitations',
  ];

  let existingTables = 0;
  let missingTables = 0;

  for (const table of expectedTables) {
    const exists = await checkTable(table);
    if (exists) {
      existingTables++;
    } else {
      missingTables++;
    }
  }

  console.log('\nSummary:');
  console.log(`- ${existingTables}/${expectedTables.length} tables exist`);
  console.log(`- ${missingTables}/${expectedTables.length} tables are missing`);

  if (existingTables === 0) {
    console.log(
      '\n⚠️ No tables from our schema exist yet. The migration has not been applied.',
    );
    console.log(
      'You will need to run the migration SQL in the Supabase SQL Editor.',
    );
  } else if (missingTables > 0) {
    console.log(
      '\n⚠️ Some tables are missing. The migration may be incomplete.',
    );
  } else {
    console.log(
      '\n✅ All expected tables exist. The migration has been successfully applied.',
    );
  }

  console.log('\nDatabase check completed');
}

main().catch((e) => console.error('Script failed:', e));
