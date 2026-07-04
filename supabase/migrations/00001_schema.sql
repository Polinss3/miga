-- ═══════════════════════════════════════════════════════════════════
-- Miga — initial schema
-- All user tables reference auth.users with ON DELETE CASCADE, so a GDPR
-- account deletion is a single admin deleteUser() call.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────

create type public.sex_type as enum ('male', 'female', 'unspecified');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'athlete');
create type public.goal_type as enum ('lose_fat', 'gain_muscle', 'maintain', 'recomposition', 'health');
create type public.planning_style as enum ('structured', 'flexible', 'mixed');
create type public.cooking_skill as enum ('beginner', 'intermediate', 'advanced');
create type public.budget_level as enum ('low', 'medium', 'high');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack', 'flexible');
create type public.food_unit as enum ('g', 'ml', 'unit', 'serving');
create type public.inventory_location as enum ('fridge', 'freezer', 'pantry', 'other');
create type public.inventory_source as enum ('receipt', 'barcode', 'manual', 'recipe', 'shopping');
create type public.shopping_category as enum ('produce', 'meat', 'dairy', 'grains', 'frozen', 'pantry', 'drinks', 'other');
create type public.recipe_difficulty as enum ('easy', 'medium', 'hard');
create type public.log_event_kind as enum ('water', 'caffeine', 'supplement');
create type public.plan_status as enum ('draft', 'active', 'archived');
create type public.subscription_status as enum ('active', 'expired', 'billing_issue', 'cancelled', 'none');
create type public.weight_source as enum ('manual', 'apple_health', 'health_connect');
create type public.product_source as enum ('open_food_facts', 'user', 'ai');
create type public.ai_request_kind as enum (
  'food_photo', 'receipt', 'nutrition_label', 'recipe_create', 'recipe_improve', 'meal_plan', 'chat'
);
create type public.ai_request_status as enum ('ok', 'error', 'rejected');

-- ── Profiles & preferences ──────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  language text not null default 'en' check (language in ('en', 'es')),
  country text,
  age int check (age between 13 and 120),
  sex public.sex_type not null default 'unspecified',
  height_cm numeric(5, 1) check (height_cm between 80 and 260),
  weight_kg numeric(5, 1) check (weight_kg between 25 and 400),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 25 and 400),
  activity_level public.activity_level not null default 'light',
  goal public.goal_type not null default 'health',
  planning_style public.planning_style not null default 'mixed',
  cooking_skill public.cooking_skill not null default 'intermediate',
  cooking_time_minutes int not null default 30 check (cooking_time_minutes between 5 and 240),
  budget_level public.budget_level not null default 'medium',
  meals_per_day int not null default 3 check (meals_per_day between 1 and 8),
  targets_mode text not null default 'automatic' check (targets_mode in ('automatic', 'manual')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_goals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  kcal int not null default 2000 check (kcal between 800 and 8000),
  protein_g int not null default 110 check (protein_g between 20 and 500),
  carbs_g int not null default 220 check (carbs_g between 0 and 1200),
  fat_g int not null default 67 check (fat_g between 15 and 400),
  water_ml int not null default 2000 check (water_ml between 500 and 8000),
  updated_at timestamptz not null default now()
);

create table public.dietary_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  restrictions text[] not null default '{}',
  dislikes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── Global food catalogs (public read, service-role write) ─────────

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_es text,
  unit public.food_unit not null default 'g',
  nutrients_per_100 jsonb not null default '{}'::jsonb,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index foods_name_idx on public.foods using gin (to_tsvector('simple', name || ' ' || coalesce(name_es, '')));

create table public.branded_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  unit public.food_unit not null default 'g',
  serving_size numeric(7, 1),
  nutrients_per_100 jsonb not null default '{}'::jsonb,
  source public.product_source not null default 'user',
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.barcode_products (
  barcode text primary key,
  product_id uuid references public.branded_products (id) on delete set null,
  name text not null,
  brand text,
  unit public.food_unit not null default 'g',
  serving_size numeric(7, 1),
  nutrients_per_100 jsonb not null default '{}'::jsonb,
  source public.product_source not null default 'open_food_facts',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Inventory ───────────────────────────────────────────────────────

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  brand text,
  quantity numeric(9, 2) not null default 1 check (quantity >= 0),
  unit public.food_unit not null default 'unit',
  location public.inventory_location not null default 'pantry',
  source public.inventory_source not null default 'manual',
  purchase_date date,
  expiry_date date,
  price numeric(9, 2) check (price is null or price >= 0),
  nutrients_per_100 jsonb,
  barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_items_user_idx on public.inventory_items (user_id, expiry_date);

-- ── Meals & daily logs ──────────────────────────────────────────────

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid unique, -- idempotency key for offline sync
  date date not null,
  meal_type public.meal_type not null default 'flexible',
  note text,
  logged_at timestamptz not null default now()
);
create index meals_user_date_idx on public.meals (user_id, date);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  name text not null,
  quantity numeric(9, 2) not null default 0 check (quantity >= 0),
  unit public.food_unit not null default 'g',
  nutrients jsonb not null default '{}'::jsonb,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid,
  inventory_item_id uuid references public.inventory_items (id) on delete set null
);
create index meal_items_meal_idx on public.meal_items (meal_id);

create table public.log_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid unique, -- idempotency key for offline sync
  date date not null,
  kind public.log_event_kind not null,
  value numeric(9, 2), -- ml for water, mg for caffeine
  name text,           -- supplement name
  created_at timestamptz not null default now()
);
create index log_events_user_date_idx on public.log_events (user_id, date);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 25 and 400),
  source public.weight_source not null default 'manual',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ── Recipes ─────────────────────────────────────────────────────────

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  steps text[] not null default '{}',
  time_minutes int check (time_minutes between 1 and 900),
  difficulty public.recipe_difficulty not null default 'easy',
  servings int not null default 2 check (servings between 1 and 50),
  image_url text,
  tags text[] not null default '{}',
  restrictions text[] not null default '{}',
  nutrients_per_serving jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_user_idx on public.recipes (user_id, created_at desc);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  quantity numeric(9, 2) not null default 0 check (quantity >= 0),
  unit public.food_unit not null default 'g',
  nutrients jsonb,
  position int not null default 0
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

alter table public.meal_items
  add constraint meal_items_recipe_fk foreign key (recipe_id) references public.recipes (id) on delete set null;

-- ── Planning ────────────────────────────────────────────────────────

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status public.plan_status not null default 'active',
  created_at timestamptz not null default now()
);
create index meal_plans_user_idx on public.meal_plans (user_id, start_date);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  date date not null,
  meal_type public.meal_type not null,
  recipe_id uuid references public.recipes (id) on delete set null,
  title text not null,
  description text,
  nutrients jsonb,
  locked boolean not null default false,
  completed boolean not null default false
);
create index meal_plan_items_plan_idx on public.meal_plan_items (plan_id, date);

-- ── Shopping ────────────────────────────────────────────────────────

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.meal_plans (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  name text not null,
  quantity numeric(9, 2),
  unit public.food_unit,
  category public.shopping_category not null default 'other',
  checked boolean not null default false,
  purchased_at timestamptz
);
create index shopping_list_items_list_idx on public.shopping_list_items (list_id);

-- ── Receipts (structured data only — images are never stored) ──────

create table public.scanned_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  store text,
  receipt_date date,
  total numeric(9, 2),
  currency text,
  created_at timestamptz not null default now()
);

create table public.scanned_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.scanned_receipts (id) on delete cascade,
  raw_text text,
  name text not null,
  brand text,
  quantity numeric(9, 2) not null default 1,
  unit public.food_unit not null default 'unit',
  price numeric(9, 2),
  category public.shopping_category not null default 'other',
  is_food boolean not null default true,
  nutrients_per_100 jsonb,
  added_to_inventory boolean not null default false
);

-- ── AI audit & quota ────────────────────────────────────────────────

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.ai_request_kind not null,
  status public.ai_request_status not null default 'ok',
  provider text,
  model text,
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_requests_user_idx on public.ai_requests (user_id, created_at desc);

create table public.ai_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ai_requests (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  month date not null, -- first day of month
  used int not null default 0,
  primary key (user_id, month)
);

-- ── Subscriptions (written only by the RevenueCat webhook) ──────────

create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.subscription_status not null default 'none',
  entitlement text not null default 'premium',
  store text,
  rc_app_user_id text,
  period_end timestamptz,
  updated_at timestamptz not null default now()
);

-- ── Health ──────────────────────────────────────────────────────────

create table public.health_connections (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('apple_health', 'health_connect', 'none')),
  connected boolean not null default false,
  permissions text[] not null default '{}',
  last_sync_at timestamptz,
  primary key (user_id, platform)
);

create table public.health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('steps', 'active_energy', 'workout')),
  value numeric(12, 2) not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, date, kind)
);

-- ── Housekeeping triggers ───────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','user_goals','dietary_preferences','user_settings',
                           'inventory_items','recipes','barcode_products','subscriptions']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Auto-provision per-user rows on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_goals (user_id) values (new.id) on conflict do nothing;
  insert into public.dietary_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
