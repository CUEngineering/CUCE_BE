#!/usr/bin/env ts-node
/**
 * Database Test Runner
 *
 * This script allows running one or all database test scripts
 * from a single entry point.
 *
 * Usage:
 *   npx ts-node src/utils/database-tests/run-tests.ts [test-name]
 *
 * Examples:
 *   npx ts-node src/utils/database-tests/run-tests.ts         # Run all tests
 *   npx ts-node src/utils/database-tests/run-tests.ts tables  # Run table verification only
 */

import { spawn } from 'child_process';
import * as path from 'path';

const TESTS = {
  tables: {
    name: 'Table Verification',
    script: 'table-verification.ts',
  },
  supabase: {
    name: 'Supabase Client Test',
    script: 'supabase-client-test.ts',
  },
  prisma: {
    name: 'Prisma Supabase Test',
    script: 'prisma-supabase-test.ts',
  },
  simple: {
    name: 'Simple Connection Test',
    script: 'simple-connection-test.ts',
  },
};

type TestResult = {
  name: string;
  success: boolean;
};

function runTest(testKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    const test = TESTS[testKey as keyof typeof TESTS];
    if (!test) {
      console.error(`Unknown test: ${testKey}`);
      resolve(false);
      return;
    }

    console.log(`\n🚀 Running ${test.name}...`);
    console.log('==================================================');

    const scriptPath = path.join(__dirname, test.script);
    const child = spawn('npx', ['ts-node', scriptPath], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      console.log('==================================================');
      if (code === 0) {
        console.log(`✅ ${test.name} completed successfully`);
        resolve(true);
      } else {
        console.log(`❌ ${test.name} failed with exit code ${code}`);
        resolve(false);
      }
    });
  });
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    // Run all tests
    console.log('📊 Running all database tests\n');

    const results: TestResult[] = [];
    for (const key of Object.keys(TESTS)) {
      results.push({
        name: TESTS[key as keyof typeof TESTS].name,
        success: await runTest(key),
      });
    }

    console.log('\n📋 Test Summary:');
    for (const result of results) {
      console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`\n${successCount}/${results.length} tests passed`);
  } else {
    // Run specific test
    await runTest(arg);
  }
}

main().catch(console.error);
