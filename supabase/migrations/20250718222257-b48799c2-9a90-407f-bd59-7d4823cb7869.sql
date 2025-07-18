-- Check if city_id column still exists and remove it if it does
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'students' AND column_name = 'city_id') THEN
        ALTER TABLE students DROP COLUMN city_id;
    END IF;
END $$;

-- Make sure city field accepts free text input
ALTER TABLE students ALTER COLUMN city DROP NOT NULL;
ALTER TABLE students ALTER COLUMN city SET DEFAULT '';