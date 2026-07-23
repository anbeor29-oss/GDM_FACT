-- ============================================================================
-- Ampliar campos de dirección en cp_ubicaciones y cp_lugares.
--
-- Motivación: el catálogo SAT usa claves cortas (colonia=4 dígitos,
-- municipio=3 dígitos, localidad=2 dígitos, estado=3 letras). El schema
-- original las declaraba VARCHAR(4) — correcto para claves.
--
-- Pero el usuario a veces captura NOMBRE en lugar de clave, y el nombre
-- no cabe ("Ciénega de Flores Centro" > 4 chars → truncado). También el
-- importador XML puede guardar nombre resuelto en algunos flujos.
--
-- Solución: ampliar a VARCHAR(60) — cabe tanto la clave (4-8 chars) como
-- el nombre humano. En el PDF/XML se resuelve por LEFT JOIN al catálogo
-- si el valor parece clave numérica.
-- ============================================================================

-- cp_ubicaciones (dirección de origen/destino de la carta porte)
ALTER TABLE cp_ubicaciones ALTER COLUMN colonia   TYPE VARCHAR(60);
ALTER TABLE cp_ubicaciones ALTER COLUMN localidad TYPE VARCHAR(60);
ALTER TABLE cp_ubicaciones ALTER COLUMN municipio TYPE VARCHAR(60);

-- cp_lugares (plantilla catálogo de ubicaciones frecuentes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cp_lugares') THEN
    EXECUTE 'ALTER TABLE cp_lugares ALTER COLUMN colonia   TYPE VARCHAR(60)';
    EXECUTE 'ALTER TABLE cp_lugares ALTER COLUMN localidad TYPE VARCHAR(60)';
    EXECUTE 'ALTER TABLE cp_lugares ALTER COLUMN municipio TYPE VARCHAR(60)';
  END IF;
END $$;

-- cp_figuras.municipio / .colonia si aplican
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'cp_figuras' AND column_name = 'colonia') THEN
    EXECUTE 'ALTER TABLE cp_figuras ALTER COLUMN colonia   TYPE VARCHAR(60)';
    EXECUTE 'ALTER TABLE cp_figuras ALTER COLUMN municipio TYPE VARCHAR(60)';
  END IF;
END $$;
