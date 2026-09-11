-- Update Business plan pricing to 50k NGN monthly and 500k NGN yearly.
-- Amount fields are stored in minor units (kobo/cents), so we multiply by 100.

BEGIN;

UPDATE public.plans
SET
  price = 5000000, -- 50,000 * 100
  yearly_price = 50000000, -- 500,000 * 100
  updated_at = NOW()
WHERE slug = 'business';

COMMIT;
