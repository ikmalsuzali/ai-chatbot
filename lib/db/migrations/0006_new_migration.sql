-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the document embeddings table
CREATE TABLE IF NOT EXISTS document_embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT,
  metadata JSONB,
  embedding vector(1536)
);

-- Create an index for better performance
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops); 