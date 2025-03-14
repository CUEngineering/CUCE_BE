// Test connectivity using Supabase JavaScript client with direct database access
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

async function testDatabaseAccess() {
  try {
    console.log('Testing Supabase database access using service role...');

    // Try to access user data through auth API (only works with service role)
    console.log('Checking auth access...');
    const { data: authData, error: authError } =
      await supabase.auth.admin.listUsers();

    if (authError) {
      console.log('Error accessing auth:', authError);
    } else {
      console.log('Auth access successful! User count:', authData.users.length);
      console.log('Connection to Supabase is working correctly!');
    }

    // Test if the test_connection_table exists, and create it if not
    console.log('Testing database access...');

    // First try to query the table
    const { data: existingData, error: queryError } = await supabase
      .from('test_connection_table')
      .select('*')
      .limit(1);

    if (queryError && queryError.code === '42P01') {
      // Table doesn't exist error
      console.log('Test table does not exist. Attempting to create it...');

      // Try creating the table with raw SQL
      const { error: createTableError } = await supabase.rpc('execute_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS test_connection_table (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `,
      });

      if (createTableError) {
        console.log('Error creating test table:', createTableError);
      } else {
        console.log('Successfully created test table!');

        // Insert test data
        const { error: insertError } = await supabase
          .from('test_connection_table')
          .insert([{ name: 'Test connection' }]);

        if (insertError) {
          console.log('Error inserting test data:', insertError);
        } else {
          console.log('Successfully inserted test data!');
        }
      }
    } else if (queryError) {
      console.log('Error querying test table:', queryError);
    } else {
      console.log('Test table exists! Data:', existingData);

      // Insert another test record
      const { error: insertError } = await supabase
        .from('test_connection_table')
        .insert([{ name: `Test connection at ${new Date().toISOString()}` }]);

      if (insertError) {
        console.log('Error inserting test data:', insertError);
      } else {
        console.log('Successfully inserted test data!');
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testDatabaseAccess()
  .then(() => console.log('Test completed'))
  .catch((e) => console.error('Test failed:', e));
