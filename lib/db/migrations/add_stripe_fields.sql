-- Up Migration
ALTER TABLE users
ADD COLUMN stripe_customer_id VARCHAR UNIQUE,
ADD COLUMN stripe_subscription_id VARCHAR UNIQUE,
ADD COLUMN subscription_status VARCHAR,
ADD COLUMN current_period_end TIMESTAMP;

-- Down Migration
ALTER TABLE users
DROP COLUMN stripe_customer_id,
DROP COLUMN stripe_subscription_id,
DROP COLUMN subscription_status,
DROP COLUMN current_period_end; 