-- OpenBrain: Cross-AI Memory System
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Memories table
CREATE TABLE memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  summary TEXT,
  source TEXT DEFAULT 'manual',
  category TEXT DEFAULT 'insight',
  tags TEXT[] DEFAULT '{}',
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valid categories: company, contact, interaction, decision, insight, task, preference, project
-- Enforced at the application layer for flexibility.

-- 3. Indexes for vector similarity search
CREATE INDEX memories_embedding_idx ON memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Indexes for filtering
CREATE INDEX memories_source_idx ON memories (source);
CREATE INDEX memories_category_idx ON memories (category);
CREATE INDEX memories_created_idx ON memories (created_at DESC);
CREATE INDEX memories_tags_idx ON memories USING gin (tags);

-- 5. Full-text search
ALTER TABLE memories ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(content, '') || ' ' || coalesce(summary, ''))
  ) STORED;
CREATE INDEX memories_fts_idx ON memories USING gin (fts);

-- 6. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 7. Semantic search function
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_source TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  summary TEXT,
  source TEXT,
  category TEXT,
  tags TEXT[],
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.summary,
    m.source,
    m.category,
    m.tags,
    m.metadata,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM memories m
  WHERE
    1 - (m.embedding <=> query_embedding) > match_threshold
    AND (filter_source IS NULL OR m.source = filter_source)
    AND (filter_category IS NULL OR m.category = filter_category)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8. Hybrid search function (semantic + full-text)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 10,
  semantic_weight FLOAT DEFAULT 0.7,
  text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  summary TEXT,
  source TEXT,
  category TEXT,
  tags TEXT[],
  metadata JSONB,
  score FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.summary,
    m.source,
    m.category,
    m.tags,
    m.metadata,
    (semantic_weight * (1 - (m.embedding <=> query_embedding))) +
    (text_weight * COALESCE(ts_rank(m.fts, plainto_tsquery('english', query_text)), 0)) AS score,
    m.created_at
  FROM memories m
  WHERE m.embedding IS NOT NULL
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

-- 9. Row-Level Security
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (backend operations)
CREATE POLICY "Service role full access" ON memories
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Anon role gets read access (MCP clients using anon key)
CREATE POLICY "Anon read access" ON memories
  FOR SELECT
  USING (true);
