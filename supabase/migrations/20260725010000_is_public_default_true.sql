-- Change is_public default to true for new contractors
ALTER TABLE contractors ALTER COLUMN is_public SET DEFAULT true;
