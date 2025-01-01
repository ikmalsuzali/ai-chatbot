import { DataProcessor } from '../utils/data_processor';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function manageDocuments() {
  const pgConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DATABASE || 'your_database',
  };

  const processor = new DataProcessor(
    process.env.HUGGINGFACE_API_KEY!,
    pgConfig,
    process.env.EMBEDDING_MODEL || 'default-hf'
  );

  await processor.initialize();

  try {
    // Clean up expired documents
    await processor.cleanupExpiredDocuments();

    // List all document groups
    const groups = await processor.getDocumentGroups();
    console.log('\nDocument Groups:');
    console.table(groups);

    // Example: Process a new version of a document
    const filePath = path.join(process.cwd(), 'public/docs/example.pdf');
    await processor.processDocumentWithMetadata(filePath, {
      replaceGroupId: 'existing-group-id', // Replace with actual group ID
      version: 2,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiry
    });

    // Search across active documents
    const searchResults = await processor.searchDocuments('your query', {
      activeOnly: true,
      fileTypes: ['pdf', 'docx'],
    });
    console.log('\nSearch Results:', searchResults);

  } catch (error) {
    console.error('Error managing documents:', error);
  } finally {
    await processor.close();
  }
}

manageDocuments().catch(console.error); 