-- ═══════════════════════════════════════════════════════════════════
-- Miga — recipe-aware inventory deduction
--
-- Before: deduction matched only the meal-item NAME against pantry items,
-- ignoring units. Cooking a recipe (one item, unit='serving') deducted
-- nothing useful, and a unit mismatch (200 g vs "2 unit") could wipe stock.
--
-- Now:
--  · Items that link a recipe (recipe_id + unit='serving') deduct each
--    recipe INGREDIENT, scaled by servings eaten / recipe servings.
--  · Name-based deduction only fires when the units match, so "200 g"
--    never subtracts from a "unit" pantry row.
-- Name matching stays exact (case-insensitive) — fuzzy matching deducts
-- the wrong things more often than it helps.
-- ═══════════════════════════════════════════════════════════════════

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
  v_item_unit public.food_unit;
  v_recipe_id uuid;
  v_recipe_servings int;
  v_inventory_id uuid;
  v_qty numeric;
  v_ing record;
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
    v_item_unit := coalesce(nullif(v_item->>'unit', ''), 'g')::public.food_unit;

    -- Only link recipes owned by the caller; silently drop anything else.
    select r.id, r.servings into v_recipe_id, v_recipe_servings
    from public.recipes r
    where r.user_id = v_user and r.id = nullif(v_item->>'recipe_id', '')::uuid;

    insert into public.meal_items (meal_id, name, quantity, unit, nutrients, inventory_item_id, recipe_id, food_id)
    values (
      v_meal_id,
      v_item->>'name',
      coalesce((v_item->>'quantity')::numeric, 0),
      v_item_unit,
      coalesce(v_item->'nutrients', '{}'::jsonb),
      nullif(v_item->>'inventory_item_id', '')::uuid,
      v_recipe_id,
      (
        select f.id from public.foods f
        where f.id = nullif(v_item->>'food_id', '')::uuid
      )
    );

    if p_deduct_inventory then
      v_qty := coalesce((v_item->>'quantity')::numeric, 0);

      if v_recipe_id is not null and v_item_unit = 'serving' then
        -- Cooking a recipe: deduct each ingredient, scaled by servings eaten.
        for v_ing in
          select ri.name, ri.quantity, ri.unit
          from public.recipe_ingredients ri
          where ri.recipe_id = v_recipe_id
        loop
          select id into v_inventory_id
          from public.inventory_items
          where user_id = v_user
            and quantity > 0
            and lower(name) = lower(v_ing.name)
            and unit = v_ing.unit
          order by expiry_date nulls last
          limit 1;

          if v_inventory_id is not null then
            update public.inventory_items
            set quantity = greatest(
              quantity - v_ing.quantity * v_qty / greatest(coalesce(v_recipe_servings, 1), 1),
              0
            )
            where id = v_inventory_id;
          end if;
        end loop;
      else
        -- Single food: deduct an explicitly referenced item, or the best
        -- name match — but only when the units agree.
        select id into v_inventory_id
        from public.inventory_items
        where user_id = v_user
          and quantity > 0
          and (
            id = nullif(v_item->>'inventory_item_id', '')::uuid
            or (lower(name) = lower(v_item->>'name') and unit = v_item_unit)
          )
        order by (id = nullif(v_item->>'inventory_item_id', '')::uuid) desc, expiry_date nulls last
        limit 1;

        if v_inventory_id is not null then
          update public.inventory_items
          set quantity = greatest(quantity - v_qty, 0)
          where id = v_inventory_id;
        end if;
      end if;
    end if;
  end loop;

  return v_meal_id;
end $$;
