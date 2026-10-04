-- Repair only the original synthetic fixture image placeholders. Preserve all other facts.
UPDATE products
SET product = jsonb_set(product, '{imageUrl}', to_jsonb('catalog://demo/' || id || '.png'))
WHERE id ~ '^[ENRW](0[1-9]|1[0-8])$'
  AND product->>'imageUrl' = 'https://fixtures.invalid/catalog/' || id || '.png';
