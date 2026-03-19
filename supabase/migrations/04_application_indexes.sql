-- Add indexes on applications email and phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_phone ON applications(phone);
