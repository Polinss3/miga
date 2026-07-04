-- ═══════════════════════════════════════════════════════════════════
-- Miga — RPCs
--
-- All functions are SECURITY DEFINER with a pinned search_path and always
-- scope writes to auth.uid(), so they are safe to expose to `authenticated`.
-- Functions used only by Edge Functions (service role) revoke EXECUTE from
-- authenticated at the end of this file.
-- ═══════════════════════════════════════════════════════════════════

-- ── Onboarding: one transactional write for the whole wizard ─────────

create or replace function public.complete_onboarding(
  p_profile jsonb,
  p_targets jsonb,
  p_restrictions text[],
  p_allergies text[],
  p_dislikes text[]
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  update public.profiles set
    display_name = nullif(p_profile->>'display_name', ''),
    language = coalesce(p_profile->>'language', language),
    country = nullif(p_profile->>'country', ''),
    age = nullif(p_profile->>'age', '')::int,
    sex = coalesce(nullif(p_profile->>'sex', ''), 'unspecified')::public.sex_type,
    height_cm = nullif(p_profile->>'height_cm', '')::numeric,
    weight_kg = nullif(p_profile->>'weight_kg', '')::numeric,
    target_weight_kg = nullif(p_profile->>'target_weight_kg', '')::numeric,
    activity_level = coalesce(nullif(p_profile->>'activity_level', ''), 'light')::public.activity_level,
    goal = coalesce(nullif(p_profile->>'goal', ''), 'health')::public.goal_type,
    planning_style = coalesce(nullif(p_profile->>'planning_style', ''), 'mixed')::public.planning_style,
    cooking_skill = coalesce(nullif(p_profile->>'cooking_skill', ''), 'intermediate')::public.cooking_skill,
    cooking_time_minutes = coalesce(nullif(p_profile->>'cooking_time_minutes', '')::int, 30),
    budget_level = coalesce(nullif(p_profile->>'budget_level', ''), 'medium')::public.budget_level,
    meals_per_day = coalesce(nullif(p_profile->>'meals_per_day', '')::int, 3),
    targets_mode = coalesce(nullif(p_profile->>'targets_mode', ''), 'automatic'),
    onboarding_completed = true
  where id = v_user;

  update public.user_goals set
    kcal = coalesce((p_targets->>'kcal')::int, kcal),
    protein_g = coalesce((p_targets->>'protein_g')::int, protein_g),
    carbs_g = coalesce((p_targets->>'carbs_g')::int, carbs_g),
    fat_g = coalesce((p_targets->>'fat_g')::int, fat_g),
    water_ml = coalesce((p_targets->>'water_ml')::int, water_ml)
  where user_id = v_user;

  update public.dietary_preferences set
    restrictions = coalesce(p_restrictions, '{}'),
    dislikes = coalesce(p_dislikes, '{}')
  where user_id = v_user;

  delete from public.allergies where user_id = v_user;
  insert into public.allergies (user_id, name)
  select v_user, trim(a) from unnest(coalesce(p_allergies, '{}')) as a
  where trim(a) <> ''
  on conflict do nothing;
end $$;

-- ── Meals: insert meal + items + optional inventory deduction ───────

create or replace function public.add_meal_with_inventory_deduction(
  p_client_id uuid,
  p_date date,
  p_meal_type text,
  p_items jsonb,
  p_deduct_inventory boolean default false
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_meal_id uuid;
  v_item jsonb;
  v_inventory_id uuid;
  v_qty numeric;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty_meal'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'too_many_items'; end if;

  -- Idempotency: a retried offline flush returns the existing meal.
  if p_client_id is not null then
    select id into v_meal_id from public.meals where client_id = p_client_id and user_id = v_user;
    if v_meal_id is not null then return v_meal_id; end if;
  end if;

  insert into public.meals (user_id, client_id, date, meal_type)
  values (v_user, p_client_id, p_date, p_meal_type::public.meal_type)
  returning id into v_meal_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.meal_items (meal_id, name, quantity, unit, nutrients, inventory_item_id)
    values (
      v_meal_id,
      v_item->>'name',
      coalesce((v_item->>'quantity')::numeric, 0),
      coalesce(nullif(v_item->>'unit', ''), 'g')::public.food_unit,
      coalesce(v_item->'nutrients', '{}'::jsonb),
      nullif(v_item->>'inventory_item_id', '')::uuid
    );

    if p_deduct_inventory then
      v_qty := coalesce((v_item->>'quantity')::numeric, 0);
      -- Deduct an explicitly referenced item, or the best name match.
      select id into v_inventory_id
      from public.inventory_items
      where user_id = v_user
        and quantity > 0
        and (
          id = nullif(v_item->>'inventory_item_id', '')::uuid
          or lower(name) = lower(v_item->>'name')
        )
      order by (id = nullif(v_item->>'inventory_item_id', '')::uuid) desc, expiry_date nulls last
      limit 1;

      if v_inventory_id is not null then
        update public.inventory_items
        set quantity = greatest(quantity - v_qty, 0)
        where id = v_inventory_id;
      end if;
    end if;
  end loop;

  return v_meal_id;
end $$;

-- ── Simple offline-capable logs (idempotent via client_id) ──────────

create or replace function public.log_water(p_client_id uuid, p_date date, p_ml numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_ml <= 0 or p_ml > 5000 then raise exception 'invalid_amount'; end if;
  insert into public.log_events (user_id, client_id, date, kind, value)
  values (auth.uid(), p_client_id, p_date, 'water', p_ml)
  on conflict (client_id) do nothing;
end $$;

create or replace function public.log_supplement(p_client_id uuid, p_date date, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'invalid_name'; end if;
  insert into public.log_events (user_id, client_id, date, kind, name)
  values (auth.uid(), p_client_id, p_date, 'supplement', left(trim(p_name), 80))
  on conflict (client_id) do nothing;
end $$;

-- ── Recipes: recipe + ingredients atomically ────────────────────────

create or replace function public.create_recipe_with_ingredients(
  p_recipe jsonb,
  p_ingredients jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_recipe_id uuid;
  v_ing jsonb;
  v_pos int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_ingredients is null or jsonb_array_length(p_ingredients) = 0 then raise exception 'no_ingredients'; end if;
  if jsonb_array_length(p_ingredients) > 60 then raise exception 'too_many_ingredients'; end if;

  insert into public.recipes (
    user_id, name, description, steps, time_minutes, difficulty, servings, tags, restrictions, nutrients_per_serving
  ) values (
    v_user,
    p_recipe->>'name',
    nullif(p_recipe->>'description', ''),
    coalesce((select array_agg(s) from jsonb_array_elements_text(p_recipe->'steps') as s), '{}'),
    nullif(p_recipe->>'time_minutes', '')::int,
    coalesce(nullif(p_recipe->>'difficulty', ''), 'easy')::public.recipe_difficulty,
    coalesce(nullif(p_recipe->>'servings', '')::int, 2),
    coalesce((select array_agg(s) from jsonb_array_elements_text(p_recipe->'tags') as s), '{}'),
    coalesce((select array_agg(s) from jsonb_array_elements_text(p_recipe->'restrictions') as s), '{}'),
    nullif(p_recipe->'nutrients_per_serving', 'null'::jsonb)
  ) returning id into v_recipe_id;

  for v_ing in select * from jsonb_array_elements(p_ingredients) loop
    insert into public.recipe_ingredients (recipe_id, name, quantity, unit, nutrients, position)
    values (
      v_recipe_id,
      v_ing->>'name',
      coalesce((v_ing->>'quantity')::numeric, 0),
      coalesce(nullif(v_ing->>'unit', ''), 'g')::public.food_unit,
      nullif(v_ing->'nutrients', 'null'::jsonb),
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  return v_recipe_id;
end $$;

-- ── Planning: accept an AI-generated plan draft ─────────────────────

create or replace function public.accept_meal_plan(p_start_date date, p_meals jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_plan_id uuid;
  v_end date;
  v_meal jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_meals is null or jsonb_array_length(p_meals) = 0 then raise exception 'empty_plan'; end if;
  if jsonb_array_length(p_meals) > 70 then raise exception 'plan_too_large'; end if;

  select max((m->>'date')::date) into v_end from jsonb_array_elements(p_meals) as m;

  select id into v_plan_id
  from public.meal_plans
  where user_id = v_user and start_date = p_start_date and status <> 'archived'
  limit 1;

  if v_plan_id is null then
    insert into public.meal_plans (user_id, start_date, end_date)
    values (v_user, p_start_date, greatest(v_end, p_start_date))
    returning id into v_plan_id;
  else
    update public.meal_plans
    set end_date = greatest(end_date, v_end), status = 'active'
    where id = v_plan_id;
  end if;

  -- Replace unlocked items on the affected dates; locked meals survive.
  delete from public.meal_plan_items i
  where i.plan_id = v_plan_id
    and i.locked = false
    and i.date in (select distinct (m->>'date')::date from jsonb_array_elements(p_meals) as m);

  for v_meal in select * from jsonb_array_elements(p_meals) loop
    if not exists (
      select 1 from public.meal_plan_items
      where plan_id = v_plan_id
        and date = (v_meal->>'date')::date
        and meal_type = (v_meal->>'meal_type')::public.meal_type
        and locked = true
    ) then
      insert into public.meal_plan_items (plan_id, date, meal_type, recipe_id, title, description, nutrients)
      values (
        v_plan_id,
        (v_meal->>'date')::date,
        (v_meal->>'meal_type')::public.meal_type,
        (
          select r.id from public.recipes r
          where r.user_id = v_user and r.id = nullif(v_meal->>'recipe_id', '')::uuid
        ),
        v_meal->>'title',
        nullif(v_meal->>'description', ''),
        v_meal->'nutrients'
      );
    end if;
  end loop;

  return v_plan_id;
end $$;

-- ── Shopping list from plan (deterministic, no AI) ──────────────────

create or replace function public.categorize_ingredient(p_name text)
returns public.shopping_category
language sql immutable
as $$
  select case
    when p_name ~* '(pollo|ternera|cerdo|pavo|carne|salm[oó]n|at[uú]n|pescado|merluza|gamba|marisco|chicken|beef|pork|turkey|meat|salmon|tuna|fish|shrimp)' then 'meat'
    when p_name ~* '(leche|yogur|queso|huevo|mantequilla|nata|milk|yogurt|cheese|egg|butter|cream)' then 'dairy'
    when p_name ~* '(manzana|pl[aá]tano|naranja|tomate|cebolla|ajo|lechuga|espinaca|pimiento|zanahoria|fruta|verdura|apple|banana|orange|tomato|onion|garlic|lettuce|spinach|pepper|carrot|fruit|vegetable|broccoli|calabac[ií]n|aguacate|avocado|lim[oó]n|lemon)' then 'produce'
    when p_name ~* '(pan|arroz|pasta|harina|avena|cereal|quinoa|bread|rice|flour|oat)' then 'grains'
    when p_name ~* '(congelado|helado|frozen|ice cream)' then 'frozen'
    when p_name ~* '(agua|zumo|jugo|caf[eé]|t[eé]|refresco|cerveza|vino|water|juice|coffee|tea|soda|beer|wine)' then 'drinks'
    else 'pantry'
  end::public.shopping_category
$$;

create or replace function public.generate_shopping_list(p_plan_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_list_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.meal_plans where id = p_plan_id and user_id = v_user) then
    raise exception 'plan_not_found';
  end if;

  -- One open list at a time: close previous ones.
  update public.shopping_lists set status = 'done' where user_id = v_user and status = 'open';

  insert into public.shopping_lists (user_id, plan_id) values (v_user, p_plan_id)
  returning id into v_list_id;

  -- Aggregate ingredients from recipe-linked plan meals, subtract pantry stock.
  insert into public.shopping_list_items (list_id, name, quantity, unit, category)
  select
    v_list_id,
    needed.name,
    case when needed.total - coalesce(stock.qty, 0) > 0 then round(needed.total - coalesce(stock.qty, 0), 2) end,
    needed.unit,
    public.categorize_ingredient(needed.name)
  from (
    select lower(ri.name) as key, min(ri.name) as name, ri.unit, sum(ri.quantity) as total
    from public.meal_plan_items mpi
    join public.recipes r on r.id = mpi.recipe_id
    join public.recipe_ingredients ri on ri.recipe_id = r.id
    where mpi.plan_id = p_plan_id and mpi.completed = false
    group by lower(ri.name), ri.unit
  ) needed
  left join (
    select lower(name) as key, unit, sum(quantity) as qty
    from public.inventory_items
    where user_id = v_user and quantity > 0
    group by lower(name), unit
  ) stock on stock.key = needed.key and stock.unit = needed.unit
  where needed.total - coalesce(stock.qty, 0) > 0;

  return v_list_id;
end $$;

create or replace function public.finish_shopping(p_list_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.shopping_lists where id = p_list_id and user_id = v_user) then
    raise exception 'list_not_found';
  end if;

  insert into public.inventory_items (user_id, name, quantity, unit, source, purchase_date)
  select v_user, i.name, coalesce(i.quantity, 1), coalesce(i.unit, 'unit'), 'shopping', current_date
  from public.shopping_list_items i
  where i.list_id = p_list_id and i.checked = true;

  get diagnostics v_count = row_count;

  update public.shopping_list_items set purchased_at = now()
  where list_id = p_list_id and checked = true;

  update public.shopping_lists set status = 'done' where id = p_list_id;

  return v_count;
end $$;

-- ── Receipts: persist confirmed structured data + inventory ─────────

create or replace function public.confirm_receipt(
  p_store text,
  p_date date,
  p_total numeric,
  p_currency text,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_receipt_id uuid;
  v_item jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty_receipt'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'too_many_items'; end if;

  insert into public.scanned_receipts (user_id, store, receipt_date, total, currency)
  values (v_user, nullif(p_store, ''), p_date, p_total, nullif(p_currency, ''))
  returning id into v_receipt_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.scanned_receipt_items
      (receipt_id, raw_text, name, brand, quantity, unit, price, category, is_food, nutrients_per_100, added_to_inventory)
    values (
      v_receipt_id,
      v_item->>'raw_text',
      v_item->>'name',
      nullif(v_item->>'brand', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(nullif(v_item->>'unit', ''), 'unit')::public.food_unit,
      nullif(v_item->>'price', '')::numeric,
      coalesce(nullif(v_item->>'category', ''), 'other')::public.shopping_category,
      coalesce((v_item->>'is_food')::boolean, true),
      nullif(v_item->'nutrients_per_100', 'null'::jsonb),
      true
    );

    insert into public.inventory_items
      (user_id, name, brand, quantity, unit, source, purchase_date, price, nutrients_per_100)
    values (
      v_user,
      v_item->>'name',
      nullif(v_item->>'brand', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce(nullif(v_item->>'unit', ''), 'unit')::public.food_unit,
      'receipt',
      coalesce(p_date, current_date),
      nullif(v_item->>'price', '')::numeric,
      nullif(v_item->'nutrients_per_100', 'null'::jsonb)
    );
  end loop;

  return v_receipt_id;
end $$;

-- ── Premium / AI quota ──────────────────────────────────────────────

create or replace function public.is_premium(p_user uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = p_user
      and status = 'active'
      and (period_end is null or period_end > now())
  )
$$;

-- Free monthly AI allowance (server-side constant).
create or replace function public.free_ai_quota()
returns int language sql immutable as $$ select 10 $$;

create or replace function public.get_ai_quota_left()
returns int
language plpgsql security definer set search_path = public stable
as $$
declare
  v_used int;
begin
  if auth.uid() is null then return 0; end if;
  select used into v_used
  from public.ai_usage
  where user_id = auth.uid() and month = date_trunc('month', current_date)::date;
  return greatest(public.free_ai_quota() - coalesce(v_used, 0), 0);
end $$;

-- Called by Edge Functions (service role) before every AI request.
-- Returns true when the request may proceed (premium, or quota consumed).
create or replace function public.consume_ai_quota_if_needed(p_user uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_used int;
begin
  if public.is_premium(p_user) then return true; end if;

  insert into public.ai_usage (user_id, month, used)
  values (p_user, date_trunc('month', current_date)::date, 0)
  on conflict (user_id, month) do nothing;

  update public.ai_usage
  set used = used + 1
  where user_id = p_user
    and month = date_trunc('month', current_date)::date
    and used < public.free_ai_quota()
  returning used into v_used;

  return v_used is not null;
end $$;

-- ── Health data erasure (user-invocable, GDPR) ──────────────────────

create or replace function public.delete_health_data()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.health_samples where user_id = auth.uid();
  delete from public.weight_logs where user_id = auth.uid() and source <> 'manual';
  update public.health_connections set connected = false, permissions = '{}' where user_id = auth.uid();
end $$;

-- ── Grants ──────────────────────────────────────────────────────────

revoke execute on function public.consume_ai_quota_if_needed(uuid) from public, anon, authenticated;
revoke execute on function public.is_premium(uuid) from public, anon;
