import { sql } from 'drizzle-orm';
import { pgTable, serial, text, varchar, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export async function up(db: any) {
  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // Create tables
  await db.schema.createTable('embedding_models', (table: any) => {
    table.serial('id').primaryKey();
    table.varchar('name', { length: 255 }).notNull().unique();
    table.varchar('model_id', { length: 255 }).notNull();
    table.integer('dimension').notNull();
    table.timestamp('created_at').defaultNow();
  });

  await db.schema.createTable('documents', (table: any) => {
    table.serial('id').primaryKey();
    table.text('url_path').notNull();
    table.varchar('file_type', { length: 50 }).notNull();
    table.text('title');
    table.text('description');
    table.boolean('is_active').notNull().default(true);
    table.varchar('document_group_id', { length: 255 });
    table.integer('version').notNull().default(1);
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultNow();
    table.timestamp('last_accessed_at');
    table.jsonb('metadata');
  });

  await db.schema.createTable('document_embeddings', (table: any) => {
    table.serial('id').primaryKey();
    table.text('content').notNull();
    table.jsonb('metadata');
    table.integer('embedding_model_id').references('embedding_models.id');
    table.integer('document_id').references('documents.id').onDelete('cascade');
    table.specificType('embedding', 'vector(1536)');
    table.varchar('file_type', { length: 50 });
    table.boolean('is_active').notNull().default(true);
    table.timestamp('created_at').defaultNow();
  });

  // Create indexes
  await sql`
    CREATE INDEX idx_documents_active ON documents(is_active);
    CREATE INDEX idx_documents_group ON documents(document_group_id);
    CREATE INDEX idx_documents_url ON documents(url_path);
    CREATE INDEX idx_embeddings_document ON document_embeddings(document_id);
    CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops);
  `;

  // Insert default model
  await db.insert(embeddingModels).values({
    name: 'default-hf',
    modelId: 'sentence-transformers/all-MiniLM-L6-v2',
    dimension: 384,
  });
}

export async function down(db: any) {
  await db.schema.dropTable('document_embeddings');
  await db.schema.dropTable('documents');
  await db.schema.dropTable('embedding_models');
  await sql`DROP EXTENSION IF EXISTS vector`;
} 