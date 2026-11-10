BEGIN;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS question_type TEXT;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS accepted_answers JSONB NOT NULL DEFAULT '[]';
UPDATE exam_questions SET question_type=CASE WHEN jsonb_array_length(options)=2 THEN 'true_false' ELSE 'multiple_choice' END WHERE question_type IS NULL;
ALTER TABLE exam_questions ALTER COLUMN question_type SET DEFAULT 'multiple_choice';
ALTER TABLE exam_questions ALTER COLUMN question_type SET NOT NULL;
ALTER TABLE exam_questions ALTER COLUMN correct_index DROP NOT NULL;
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_options_check;
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_correct_index_check;
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_typed_check;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_typed_check CHECK (
 (question_type IN ('multiple_choice','true_false') AND jsonb_typeof(options)='array' AND jsonb_array_length(options)=CASE WHEN question_type='true_false' THEN 2 ELSE 4 END AND correct_index IS NOT NULL AND correct_index>=0 AND correct_index<jsonb_array_length(options) AND accepted_answers='[]'::jsonb)
 OR
 (question_type IN ('identification','enumeration') AND options='[]'::jsonb AND correct_index IS NULL AND jsonb_typeof(accepted_answers)='array' AND jsonb_array_length(accepted_answers) BETWEEN 1 AND CASE WHEN question_type='identification' THEN 1 ELSE 20 END)
);
COMMIT;
