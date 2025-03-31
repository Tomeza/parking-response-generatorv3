/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking indexes for Knowledge table...');
  try {
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Knowledge';
    `;
    console.log('Indexes found:');
    // Ensure the output is easily readable, even if it's large
    console.dir(indexes, { depth: null }); 
  } catch (error) {
    console.error('Error fetching indexes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 