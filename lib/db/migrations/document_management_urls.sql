-- Create a table to store document information
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    url_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    title TEXT,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    document_group_id VARCHAR(255),
    version INTEGER NOT NULL DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB
);

-- Add document reference to embeddings table
ALTER TABLE document_embeddings
ADD COLUMN document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_documents_active ON documents(is_active);
CREATE INDEX idx_documents_group ON documents(document_group_id);
CREATE INDEX idx_documents_url ON documents(url_path);
CREATE INDEX idx_embeddings_document ON document_embeddings(document_id); 