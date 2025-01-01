-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table to store embedding model configurations
CREATE TABLE IF NOT EXISTS embedding_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    model_id VARCHAR(255) NOT NULL,
    dimension INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- Create the document embeddings table with dynamic vector dimensions
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding_model_id INTEGER REFERENCES embedding_models(id),
    embedding vector(1024), -- Default dimension for HuggingFace models
    file_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default HuggingFace model
INSERT INTO embedding_models (name, model_id, dimension) 
VALUES ('default-hf', 'sentence-transformers/all-MiniLM-L6-v2', 384)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON document_embeddings (embedding_model_id);
CREATE INDEX ON document_embeddings (file_type); 