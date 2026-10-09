-- 006_orders_tracking_number.sql
-- Add tracking_number column to orders table

ALTER TABLE orders ADD COLUMN tracking_number TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
