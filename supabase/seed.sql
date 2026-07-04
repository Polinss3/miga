-- Miga — seed data: a small verified base-food catalog (per 100 g/ml)
-- used for manual search and as grounding examples. Extend freely.

insert into public.foods (name, name_es, unit, nutrients_per_100, verified) values
  ('Chicken breast, raw', 'Pechuga de pollo, cruda', 'g', '{"kcal":120,"protein_g":22.5,"carbs_g":0,"fat_g":2.6}', true),
  ('White rice, cooked', 'Arroz blanco, cocido', 'g', '{"kcal":130,"protein_g":2.7,"carbs_g":28.2,"fat_g":0.3}', true),
  ('Whole egg', 'Huevo entero', 'g', '{"kcal":143,"protein_g":12.6,"carbs_g":0.7,"fat_g":9.5}', true),
  ('Rolled oats', 'Copos de avena', 'g', '{"kcal":379,"protein_g":13.2,"carbs_g":67.7,"fat_g":6.5,"fiber_g":10.1}', true),
  ('Whole milk', 'Leche entera', 'ml', '{"kcal":61,"protein_g":3.2,"carbs_g":4.8,"fat_g":3.3}', true),
  ('Greek yogurt, plain', 'Yogur griego natural', 'g', '{"kcal":97,"protein_g":9,"carbs_g":3.9,"fat_g":5}', true),
  ('Olive oil', 'Aceite de oliva', 'ml', '{"kcal":884,"protein_g":0,"carbs_g":0,"fat_g":100}', true),
  ('Banana', 'Plátano', 'g', '{"kcal":89,"protein_g":1.1,"carbs_g":22.8,"fat_g":0.3,"fiber_g":2.6,"sugar_g":12.2}', true),
  ('Apple', 'Manzana', 'g', '{"kcal":52,"protein_g":0.3,"carbs_g":13.8,"fat_g":0.2,"fiber_g":2.4,"sugar_g":10.4}', true),
  ('Broccoli, raw', 'Brócoli, crudo', 'g', '{"kcal":34,"protein_g":2.8,"carbs_g":6.6,"fat_g":0.4,"fiber_g":2.6}', true),
  ('Salmon, raw', 'Salmón, crudo', 'g', '{"kcal":208,"protein_g":20.4,"carbs_g":0,"fat_g":13.4}', true),
  ('Canned tuna in water', 'Atún al natural', 'g', '{"kcal":116,"protein_g":25.5,"carbs_g":0,"fat_g":0.8}', true),
  ('Lentils, cooked', 'Lentejas, cocidas', 'g', '{"kcal":116,"protein_g":9,"carbs_g":20.1,"fat_g":0.4,"fiber_g":7.9}', true),
  ('Chickpeas, cooked', 'Garbanzos, cocidos', 'g', '{"kcal":164,"protein_g":8.9,"carbs_g":27.4,"fat_g":2.6,"fiber_g":7.6}', true),
  ('Whole wheat bread', 'Pan integral', 'g', '{"kcal":247,"protein_g":13,"carbs_g":41,"fat_g":3.4,"fiber_g":7}', true),
  ('Pasta, cooked', 'Pasta, cocida', 'g', '{"kcal":158,"protein_g":5.8,"carbs_g":30.9,"fat_g":0.9}', true),
  ('Potato, boiled', 'Patata, cocida', 'g', '{"kcal":87,"protein_g":1.9,"carbs_g":20.1,"fat_g":0.1}', true),
  ('Almonds', 'Almendras', 'g', '{"kcal":579,"protein_g":21.2,"carbs_g":21.6,"fat_g":49.9,"fiber_g":12.5}', true),
  ('Avocado', 'Aguacate', 'g', '{"kcal":160,"protein_g":2,"carbs_g":8.5,"fat_g":14.7,"fiber_g":6.7}', true),
  ('Tomato', 'Tomate', 'g', '{"kcal":18,"protein_g":0.9,"carbs_g":3.9,"fat_g":0.2}', true),
  ('Espresso coffee', 'Café espresso', 'ml', '{"kcal":2,"protein_g":0.1,"carbs_g":0,"fat_g":0,"caffeine_mg":212}', true),
  ('Extra firm tofu', 'Tofu firme', 'g', '{"kcal":144,"protein_g":17.3,"carbs_g":2.8,"fat_g":8.7}', true)
on conflict do nothing;
