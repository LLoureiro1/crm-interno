
-- Add unit_id and class_ids to interviewer_availability
ALTER TABLE "public"."interviewer_availability" 
ADD COLUMN "unit_id" uuid REFERENCES "public"."units"("id"),
ADD COLUMN "class_ids" uuid[] DEFAULT '{}';

-- Create an index for faster searching
CREATE INDEX idx_interviewer_availability_unit ON "public"."interviewer_availability"("unit_id");
