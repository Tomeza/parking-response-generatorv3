/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Updating index on search_vector column...');

  try {
    console.log('Attempting to drop existing B-tree index Knowledge_search_vector_idx...');
    // エラーが発生しても続行するように try-catch を個別に使用
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Knowledge_search_vector_idx";`);
      console.log('Successfully dropped index Knowledge_search_vector_idx or it did not exist.');
    } catch (dropError) {
        // IF EXISTS があれば通常エラーにならないはずだが念のため
        console.warn('Could not drop index Knowledge_search_vector_idx (might not be critical):', dropError.message);
    }

    console.log('Creating new PGroonga index pgroonga_search_vector_index on search_vector...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS pgroonga_search_vector_index
      ON "Knowledge"
      USING pgroonga (search_vector);
    `);
    console.log('Successfully created PGroonga index pgroonga_search_vector_index on search_vector or it already existed.');

    console.log('Index update process completed successfully.');

  } catch (error) {
    console.error('Error during index update process:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 