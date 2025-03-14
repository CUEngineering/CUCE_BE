// This is a simple script to test the database connection
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Attempting to connect to the database...');
    await prisma.$connect();
    console.log('Connection successful!');

    // Try a simple query
    const databaseExists = await prisma.$queryRaw`SELECT current_database()`;
    console.log('Database query result:', databaseExists);
  } catch (error) {
    console.error('Error connecting to the database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => console.log('Test completed'))
  .catch((e) => console.error('Test failed:', e));
