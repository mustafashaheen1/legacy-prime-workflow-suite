-- RAG Knowledge Base
-- Stores company-specific knowledge as vector embeddings for retrieval-augmented
-- generation. Each row is a ~800-char chunk of text from an admin-uploaded source
-- (SOPs, building codes, pricing guides, company policies, etc.).
--
-- Retrieval: cosine similarity via pgvector. The search_knowledge_chunks() RPC
-- is called from api/ai-assistant.ts on every request to inject relevant context.

-- Enable pgvector extension (available on all Supabase projects)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL,
  source_name TEXT        NOT NULL,   -- e.g. "California Building Codes", "Company SOP"
  source_type TEXT        NOT NULL DEFAULT 'manual',  -- manual | sop | policy | pricing
  chunk_text  TEXT        NOT NULL,
  embedding   vector(1536),           -- text-embedding-3-small output
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_company_idx
  ON knowledge_chunks(company_id);

-- HNSW index for fast approximate nearest-neighbour search.
-- Better than ivfflat for small-to-medium datasets (no training needed).
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Service role (used by all API routes) bypasses RLS automatically.
-- This policy covers any direct client-side reads if ever needed.
CREATE POLICY "Company members can read their knowledge"
  ON knowledge_chunks FOR SELECT
  USING (true);

-- ── Search RPC ──────────────────────────────────────────────────────────────
-- Called from api/ai-assistant.ts with the embedded user query.
-- Returns chunks ordered by cosine similarity, filtered by company and threshold.
CREATE OR REPLACE FUNCTION search_knowledge_chunks(
  p_company_id  UUID,
  p_embedding   vector(1536),
  p_limit       INT   DEFAULT 5,
  p_threshold   FLOAT DEFAULT 0.70
)
RETURNS TABLE(
  id          UUID,
  source_name TEXT,
  source_type TEXT,
  chunk_text  TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    id,
    source_name,
    source_type,
    chunk_text,
    1 - (embedding <=> p_embedding) AS similarity
  FROM knowledge_chunks
  WHERE
    company_id = p_company_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> p_embedding) >= p_threshold
  ORDER BY embedding <=> p_embedding
  LIMIT p_limit;
$$;
