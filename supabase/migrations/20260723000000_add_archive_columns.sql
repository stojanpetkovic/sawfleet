-- Add archive columns to permit_leads table
-- These columns support the soft-delete pattern for lead archival

ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;

-- Create index for faster filtering of active leads
CREATE INDEX IF NOT EXISTS idx_permit_leads_archived_at ON permit_leads(archived_at) WHERE archived_at IS NULL;
