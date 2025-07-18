-- Remove foreign key constraint between students and cities
-- and add a simple text field for city name
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_city_id_fkey;

-- Add city text field and update existing data
ALTER TABLE students ADD COLUMN city TEXT;

-- Update existing data to use city name instead of city_id
UPDATE students 
SET city = COALESCE(
  (SELECT name FROM cities WHERE id = students.city_id),
  'Não informado'
)
WHERE city IS NULL;

-- Make city field NOT NULL with default
ALTER TABLE students ALTER COLUMN city SET NOT NULL;
ALTER TABLE students ALTER COLUMN city SET DEFAULT 'Não informado';

-- Remove city_id column as it's no longer needed
ALTER TABLE students DROP COLUMN city_id;