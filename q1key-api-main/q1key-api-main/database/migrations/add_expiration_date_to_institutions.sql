-- Add expiration_date column to institutions table
ALTER TABLE institutions 
ADD COLUMN expiration_date DATE NULL;

COMMENT ON COLUMN institutions.expiration_date IS 'Date when the institution subscription expires. Institution will be automatically deactivated after this date.';
