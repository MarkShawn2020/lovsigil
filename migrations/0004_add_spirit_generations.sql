-- Add spirit_generations table for storing mirror generation records
CREATE TABLE IF NOT EXISTS "spirit_generations" (
  "id" SERIAL PRIMARY KEY,
  "spirit_id" VARCHAR(20) NOT NULL,
  "spirit_name" VARCHAR(100),
  "user_photo" TEXT,
  "generated_image" TEXT NOT NULL,
  "prompt" TEXT,
  "spirit_scores" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Index for querying by spirit type
CREATE INDEX IF NOT EXISTS "idx_spirit_generations_spirit_id" ON "spirit_generations" ("spirit_id");

-- Index for recent generations
CREATE INDEX IF NOT EXISTS "idx_spirit_generations_created_at" ON "spirit_generations" ("created_at" DESC);
