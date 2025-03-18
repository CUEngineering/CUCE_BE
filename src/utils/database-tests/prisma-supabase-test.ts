// Test connectivity using Supabase JavaScript client
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');

    // Get database time using raw SQL
    const result = await supabase.rpc('get_database_time');
    const data = result.data;
    const error = result.error;

    if (error) {
      console.error('Error executing function:', error);

      // Create a simple test function if it doesn't exist
      console.log('Creating test function...');
      const createResult = await supabase.rpc('create_test_function');
      const createError = createResult.error;

      if (createError) {
        console.error('Error creating function:', createError);

        // Let's try a very simple query
        console.log('Trying simple query...');
        const result = await supabase.auth.getSession();
        console.log('Auth session result:', result);
      } else {
        console.log('Test function created successfully');

        // Try the function again
        const newResult = await supabase.rpc('get_database_time');
        const newData = newResult.data;
        const newError = newResult.error;

        if (newError) {
          console.error('Error after creating function:', newError);
        } else {
          console.log('Database time:', newData);
        }
      }
    } else {
      console.log('Connection successful!');
      console.log('Database time:', data);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testConnection()
  .then(() => console.log('Test completed'))
  .catch((e) => console.error('Test failed:', e));
