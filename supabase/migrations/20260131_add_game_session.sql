-- Add session_id for game mode grouping
-- Each game session groups multiple sigil generations together

ALTER TABLE sigil_generations
ADD COLUMN IF NOT EXISTS session_id VARCHAR(50);

-- Index for efficient session queries
CREATE INDEX IF NOT EXISTS idx_sigil_generations_session_id
ON sigil_generations(session_id)
WHERE session_id IS NOT NULL;

-- Composite index for session + created_at ordering
CREATE INDEX IF NOT EXISTS idx_sigil_generations_session_created
ON sigil_generations(session_id, created_at DESC)
WHERE session_id IS NOT NULL;
