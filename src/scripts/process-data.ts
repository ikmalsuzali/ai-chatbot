import { DataProcessor } from '../utils/data_processor';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const DOCS_DIR = path.join(process.cwd(), 'public/documents');

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const pgConfig = process.env.POSTGRES_URL || 'postgresql://postgres@localhost:5432/your_database';

  // List available embedding models
  console.log('Available embedding models:');
  const processor = new DataProcessor(
    process.env.OPENAI_API_KEY,
    pgConfig,
    process.env.EMBEDDING_MODEL || 'default-hf'
  );

  // Initialize the processor
  await processor.initialize();

  try {
    console.log('Processing documents from:', DOCS_DIR);
    await processor.processDirectory(DOCS_DIR);

    // if (process.env.PROCESS_DB === 'true') {
      // console.log('Processing database data...');
      // await processor.processPostgresData(
      //   'SELECT * FROM documents',
      //   ['content', 'description'],
      //   ['id', 'title', 'created_at']
      // );
    // }

    console.log('Data processing completed successfully!');
  } catch (error) {
    console.error('Error processing data:', error);
    process.exit(1);
  } finally {
    await processor.close();
  }
}

main(); 