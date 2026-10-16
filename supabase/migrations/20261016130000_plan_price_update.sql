update public.plan_tariffs
set
  monthly_ils = 99,
  included_users = 2,
  extra_user_ils = 40,
  voice_agorot_per_minute = 90,
  whatsapp_customer_agorot = 11,
  whatsapp_business_agorot = 25,
  updated_at = now()
where plan = 'regular';

update public.plan_tariffs
set
  monthly_ils = 199,
  included_users = 4,
  extra_user_ils = 30,
  voice_agorot_per_minute = 70,
  whatsapp_customer_agorot = 9,
  whatsapp_business_agorot = 22,
  updated_at = now()
where plan = 'expanded';
