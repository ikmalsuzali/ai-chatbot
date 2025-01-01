import { DataProcessor } from '../utils/data_processor';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function manageDocumentUrls() {
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
    // List all documents
    console.log('\nAll Documents:');
    const documents = await processor.listDocuments();
    console.table(documents.map(d => ({
      id: d.id,
      url: d.url_path,
      type: d.file_type,
      active: d.is_active,
      version: d.version,
      group: d.document_group_id
    })));

    // Example: Toggle document active status
    const documentId = 1; // Replace with actual document ID
    await processor.toggleDocumentActive(documentId, false);
    console.log(`\nToggled document ${documentId} status`);

    // Example: Update document metadata
    const updatedDoc = await processor.updateDocumentMetadata(documentId, {
      title: 'Updated Title',
      description: 'Updated description',
      metadata: { tags: ['important', 'updated'] }
    });
    console.log('\nUpdated document:', updatedDoc);

    // Example: Search only active documents
    const searchResults = await processor.searchDocuments('your query', {
      activeOnly: true,
      fileTypes: ['pdf']
    });
    console.log('\nSearch Results:', searchResults);

  } catch (error) {
    console.error('Error managing document URLs:', error);
  } finally {
    await processor.close();
  }
}

manageDocumentUrls().catch(console.error); 