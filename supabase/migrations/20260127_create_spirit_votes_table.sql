-- Create spirit_votes table to track individual user votes
CREATE TABLE IF NOT EXISTS "spirit_votes" (
  "id" SERIAL PRIMARY KEY,
  "generation_id" INTEGER NOT NULL REFERENCES "spirit_generations"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL,  -- Can be authenticated user ID or device fingerprint
  "vote" SMALLINT NOT NULL CHECK (vote IN (-1, 1)),  -- -1 = dislike, 1 = like
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("generation_id", "user_id")
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_spirit_votes_generation" ON "spirit_votes" ("generation_id");
CREATE INDEX IF NOT EXISTS "idx_spirit_votes_user" ON "spirit_votes" ("user_id");

-- Add votes column to spirit_generations (net votes = likes - dislikes)
ALTER TABLE "spirit_generations" ADD COLUMN IF NOT EXISTS "votes" INTEGER DEFAULT 0 NOT NULL;

-- Update existing records: votes = likes - dislikes
UPDATE "spirit_generations" SET "votes" = COALESCE("likes", 0) - COALESCE("dislikes", 0);

-- Create index for sorting by votes
CREATE INDEX IF NOT EXISTS "idx_spirit_generations_votes" ON "spirit_generations" ("votes" DESC, "created_at" DESC);
