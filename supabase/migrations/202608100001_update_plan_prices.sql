-- Update existing plan prices to match current pricing.
-- Amount fields are stored in minor units (kobo/cents).

BEGIN;

UPDATE public.plans
SET
  price = 3000000,
  yearly_price = 30000000,
  currency = 'NGN',
  updated_at = NOW()
WHERE slug = 'pro';

UPDATE public.plans
SET
  price = 10000000,
  yearly_price = 100000000,
  currency = 'NGN',
  updated_at = NOW()
WHERE slug = 'business';

UPDATE public.plans
SET
  currency = 'NGN',
  updated_at = NOW()
WHERE slug = 'free';

COMMIT;
