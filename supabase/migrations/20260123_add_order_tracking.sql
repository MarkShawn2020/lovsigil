-- Add order tracking columns to spirit_generations
-- order_id: UUID for public URL access (don't expose internal ID)
-- status: Track generation progress (pending, generating, completed, failed)

-- Add order_id column with auto-generated UUID
ALTER TABLE spirit_generations
ADD COLUMN IF NOT EXISTS "order_id" UUID DEFAULT gen_random_uuid() UNIQUE;

-- Add status column
ALTER TABLE spirit_generations
ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT 'completed' NOT NULL;

-- Index for fast lookup by order_id
CREATE INDEX IF NOT EXISTS idx_spirit_generations_order_id ON spirit_generations(order_id);

-- Update existing records to have 'completed' status (they already have images)
UPDATE spirit_generations SET status = 'completed' WHERE status IS NULL OR status = '';

-- Add check constraint for valid status values
ALTER TABLE spirit_generations
ADD CONSTRAINT chk_spirit_generations_status
CHECK (status IN ('pending', 'generating', 'completed', 'failed'));
