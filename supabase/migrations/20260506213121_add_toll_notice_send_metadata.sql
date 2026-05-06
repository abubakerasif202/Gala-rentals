ALTER TABLE toll_transfer_notices
  ADD COLUMN IF NOT EXISTS sent_to TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_toll_transfer_notices_sent_at
  ON toll_transfer_notices(sent_at);
