-- Fix 1: RLS policies - restrict service_role properly, anon gets read-only
DROP POLICY IF EXISTS "Service role full access" ON memories;
DROP POLICY IF EXISTS "Anon read access" ON memories;

CREATE POLICY "Service role full access" ON memories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon read access" ON memories
  FOR SELECT
  TO anon
  USING (true);

-- Fix 4: Replace IVFFlat with HNSW index (works without training data)
DROP INDEX IF EXISTS memories_embedding_idx;
CREATE INDEX memories_embedding_idx ON memories
  USING hnsw (embedding vector_cosine_ops);

-- Fix 2: Server-side stats function (avoids fetching all rows to count in JS)
CREATE OR REPLACE FUNCTION brain_stats()
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM memories),
    'by_source', COALESCE(
      (SELECT json_object_agg(source, cnt)
       FROM (SELECT source, COUNT(*) AS cnt FROM memories GROUP BY source ORDER BY cnt DESC) s),
      '{}'::json
    ),
    'by_category', COALESCE(
      (SELECT json_object_agg(category, cnt)
       FROM (SELECT category, COUNT(*) AS cnt FROM memories GROUP BY category ORDER BY cnt DESC) c),
      '{}'::json
    )
  ) INTO result;
  RETURN result;
END;
$$;
