-- Add management fields to document_embeddings table
ALTER TABLE document_embeddings
ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN document_group_id VARCHAR(255),
ADD COLUMN replaced_by_id INTEGER REFERENCES document_embeddings(id),
ADD COLUMN source_path TEXT,
ADD COLUMN last_accessed_at TIMESTAMP WITH TIME ZONE;

-- Create index for common queries
CREATE INDEX idx_document_embeddings_active ON document_embeddings(is_active);
CREATE INDEX idx_document_embeddings_group ON document_embeddings(document_group_id);
CREATE INDEX idx_document_embeddings_expires ON document_embeddings(expires_at); 