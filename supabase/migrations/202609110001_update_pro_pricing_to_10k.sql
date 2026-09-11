-- Update Pro plan pricing to 10k NGN monthly and 100k NGN yearly.
-- Amount fields are stored in minor units (kobo/cents), so we multiply by 100.

BEGIN;

UPDATE public.plans
SET
  price = 1000000, -- 10,000 * 100
  yearly_price = 10000000, -- 100,000 * 100
  updated_at = NOW()
WHERE slug = 'pro';

COMMIT;
