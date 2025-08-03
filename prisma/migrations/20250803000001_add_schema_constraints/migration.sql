-- Add NOT NULL constraints for routing keys
ALTER TABLE "public"."Templates" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "public"."Templates" ALTER COLUMN "intent" SET NOT NULL;
ALTER TABLE "public"."Templates" ALTER COLUMN "tone" SET NOT NULL;
ALTER TABLE "public"."Templates" ALTER COLUMN "status" SET NOT NULL;

-- Add CHECK constraint for status values
ALTER TABLE "public"."Templates" ADD CONSTRAINT "Templates_status_check" 
  CHECK ("status" IN ('draft', 'pending', 'approved', 'archived'));

-- Add CHECK constraint for version (positive integer)
ALTER TABLE "public"."Templates" ADD CONSTRAINT "Templates_version_check" 
  CHECK ("version" > 0); 