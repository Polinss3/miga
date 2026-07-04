-- ═══════════════════════════════════════════════════════════════════
-- Miga — AI-generated shopping lists
--
-- The old generate_shopping_list only aggregated ingredients from recipe-
-- linked plan meals, so AI plans (recipe_id null) produced a near-empty list.
-- The AI shopping-list Edge Function builds a generous, real-product list from
-- the whole weekly menu and subtracts the pantry; this RPC just persists it.
-- ═══════════════════════════════════════════════════════════════════

-- Audit kind for the new AI feature (used at runtime, not in this migration).
alter type public.ai_request_kind add value if not exists 'shopping_list';

create or replace function public.save_shopping_list(p_plan_id uuid, p_items jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_list_id uuid;
  v_item jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'empty_list'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'too_many_items'; end if;

  -- Ignore a plan reference that isn't the caller's.
  if p_plan_id is not null and not exists (
    select 1 from public.meal_plans where id = p_plan_id and user_id = v_user
  ) then
    p_plan_id := null;
  end if;

  -- One open list at a time.
  update public.shopping_lists set status = 'done' where user_id = v_user and status = 'open';

  insert into public.shopping_lists (user_id, plan_id) values (v_user, p_plan_id)
  returning id into v_list_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.shopping_list_items (list_id, name, quantity, unit, category)
    values (
      v_list_id,
      left(v_item->>'name', 120),
      nullif(v_item->>'quantity', '')::numeric,
      nullif(v_item->>'unit', '')::public.food_unit,
      coalesce(nullif(v_item->>'category', ''), 'other')::public.shopping_category
    );
  end loop;

  return v_list_id;
end $$;
