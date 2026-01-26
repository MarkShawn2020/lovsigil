-- Add likes and dislikes columns to spirit_generations table
ALTER TABLE "spirit_generations"
ADD COLUMN IF NOT EXISTS "likes" INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS "dislikes" INTEGER DEFAULT 0 NOT NULL;

-- Index for sorting by likes (most popular first)
CREATE INDEX IF NOT EXISTS "idx_spirit_generations_likes" ON "spirit_generations" ("likes" DESC, "created_at" DESC);
