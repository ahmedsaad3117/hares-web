-- Fix password column name to match entity
ALTER TABLE users RENAME COLUMN password TO password_hash;
