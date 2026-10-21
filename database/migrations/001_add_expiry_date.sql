-- ============================================================
-- Migration: Add expiry date tracking to products
-- Safe to run on an existing database — only adds a nullable column
-- and an index, no data is touched or lost.
--
-- Run with:
--   psql -U postgres -d smart_retail -f database/migrations/001_add_expiry_date.sql
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_products_expiry
    ON products(expiry_date) WHERE expiry_date IS NOT NULL;
