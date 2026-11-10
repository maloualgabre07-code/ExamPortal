BEGIN;
ALTER TABLE exam_classes ADD COLUMN IF NOT EXISTS join_code VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS class_join_code_unique ON exam_classes(join_code);
COMMIT;
