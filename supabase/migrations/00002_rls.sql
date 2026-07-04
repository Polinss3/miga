-- ═══════════════════════════════════════════════════════════════════
-- Miga — Row Level Security
--
-- Principles:
--  · Every user table: owner-only access via auth.uid().
--  · Global catalogs (foods, branded_products, barcode_products):
--    read for authenticated users, write only via service role
--    (Edge Functions) — no client policies at all.
--  · Compound/critical writes (meals with inventory deduction, receipts,
--    plans, quotas, subscriptions) have NO client INSERT policies; they go
--    through SECURITY DEFINER RPCs or service-role Edge Functions.
--  · meal_plan_items: clients may only flip locked/completed (column grant).
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.user_goals enable row level security;
alter table public.dietary_preferences enable row level security;
alter table public.allergies enable row level security;
alter table public.user_settings enable row level security;
alter table public.foods enable row level security;
alter table public.branded_products enable row level security;
alter table public.barcode_products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.log_events enable row level security;
alter table public.weight_logs enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.scanned_receipts enable row level security;
alter table public.scanned_receipt_items enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_results enable row level security;
alter table public.ai_usage enable row level security;
alter table public.subscriptions enable row level security;
alter table public.health_connections enable row level security;
alter table public.health_samples enable row level security;

-- ── Profile & preferences: owner read/update (rows created by trigger) ──

create policy "own profile read" on public.profiles for select using (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid());

create policy "own goals read" on public.user_goals for select using (user_id = auth.uid());

create policy "own diet read" on public.dietary_preferences for select using (user_id = auth.uid());
create policy "own diet update" on public.dietary_preferences for update using (user_id = auth.uid());

create policy "own allergies" on public.allergies for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own settings read" on public.user_settings for select using (user_id = auth.uid());
create policy "own settings update" on public.user_settings for update using (user_id = auth.uid());

-- ── Global catalogs: authenticated read only ────────────────────────

create policy "catalog read" on public.foods for select to authenticated using (true);
create policy "catalog read" on public.branded_products for select to authenticated using (true);
create policy "catalog read" on public.barcode_products for select to authenticated using (true);

-- ── Inventory: full owner CRUD (single-row, low risk) ───────────────

create policy "own inventory" on public.inventory_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Meals: owner read/delete; INSERT only via RPC ───────────────────

create policy "own meals read" on public.meals for select using (user_id = auth.uid());
create policy "own meals delete" on public.meals for delete using (user_id = auth.uid());

create policy "own meal items read" on public.meal_items for select
  using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()));
create policy "own meal items delete" on public.meal_items for delete
  using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()));

-- ── Log events / weight ─────────────────────────────────────────────

create policy "own log events read" on public.log_events for select using (user_id = auth.uid());
create policy "own log events delete" on public.log_events for delete using (user_id = auth.uid());

create policy "own weight" on public.weight_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and source = 'manual');

-- ── Recipes: owner read/update/delete; INSERT via RPC ───────────────

create policy "own recipes read" on public.recipes for select using (user_id = auth.uid());
create policy "own recipes update" on public.recipes for update using (user_id = auth.uid());
create policy "own recipes delete" on public.recipes for delete using (user_id = auth.uid());

create policy "own recipe ingredients read" on public.recipe_ingredients for select
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));
create policy "own recipe ingredients delete" on public.recipe_ingredients for delete
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = auth.uid()));

-- ── Plans: owner read; item updates limited to locked/completed ─────

create policy "own plans read" on public.meal_plans for select using (user_id = auth.uid());
create policy "own plans delete" on public.meal_plans for delete using (user_id = auth.uid());

create policy "own plan items read" on public.meal_plan_items for select
  using (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = auth.uid()));
create policy "own plan items update" on public.meal_plan_items for update
  using (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = auth.uid()));

-- Clients may only toggle these two columns; everything else via RPC.
revoke update on public.meal_plan_items from authenticated;
grant update (locked, completed) on public.meal_plan_items to authenticated;

-- ── Shopping: owner read + check toggle; creation via RPC ───────────

create policy "own lists read" on public.shopping_lists for select using (user_id = auth.uid());
create policy "own lists delete" on public.shopping_lists for delete using (user_id = auth.uid());

create policy "own list items read" on public.shopping_list_items for select
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "own list items update" on public.shopping_list_items for update
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "own list items delete" on public.shopping_list_items for delete
  using (exists (select 1 from public.shopping_lists l where l.id = list_id and l.user_id = auth.uid()));

revoke update on public.shopping_list_items from authenticated;
grant update (checked) on public.shopping_list_items to authenticated;

-- ── Receipts: read own; writes only via RPC/service ─────────────────

create policy "own receipts read" on public.scanned_receipts for select using (user_id = auth.uid());
create policy "own receipt items read" on public.scanned_receipt_items for select
  using (exists (select 1 from public.scanned_receipts r where r.id = receipt_id and r.user_id = auth.uid()));

-- ── AI audit: read own; written by service role only ────────────────

create policy "own ai requests read" on public.ai_requests for select using (user_id = auth.uid());
create policy "own ai results read" on public.ai_results for select
  using (exists (select 1 from public.ai_requests q where q.id = request_id and q.user_id = auth.uid()));
create policy "own ai usage read" on public.ai_usage for select using (user_id = auth.uid());

-- ── Subscriptions: read own; written by webhook (service role) ──────

create policy "own subscription read" on public.subscriptions for select using (user_id = auth.uid());

-- ── Health ──────────────────────────────────────────────────────────

create policy "own health connections" on public.health_connections for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own health samples read" on public.health_samples for select using (user_id = auth.uid());
create policy "own health samples delete" on public.health_samples for delete using (user_id = auth.uid());
