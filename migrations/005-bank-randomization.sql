BEGIN;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS sample_count INTEGER NOT NULL DEFAULT 0 CHECK(sample_count BETWEEN 0 AND 100);
CREATE TABLE IF NOT EXISTS bank_questions (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id INTEGER NOT NULL REFERENCES users(id),
 subject VARCHAR(100) NOT NULL DEFAULT '',
 difficulty VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
 prompt TEXT NOT NULL CHECK(length(trim(prompt)) BETWEEN 1 AND 2000),
 options JSONB NOT NULL,
 correct_index INTEGER,
 points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 100),
 question_type TEXT NOT NULL,
 accepted_answers JSONB NOT NULL DEFAULT '[]',
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT bank_questions_typed_check CHECK (
  (question_type IN ('multiple_choice','true_false') AND jsonb_typeof(options)='array' AND jsonb_array_length(options)=CASE WHEN question_type='true_false' THEN 2 ELSE 4 END AND correct_index IS NOT NULL AND correct_index>=0 AND correct_index<jsonb_array_length(options) AND accepted_answers='[]'::jsonb)
  OR (question_type IN ('identification','enumeration') AND options='[]'::jsonb AND correct_index IS NULL AND jsonb_typeof(accepted_answers)='array' AND jsonb_array_length(accepted_answers) BETWEEN 1 AND CASE WHEN question_type='identification' THEN 1 ELSE 20 END)
 )
);
CREATE INDEX IF NOT EXISTS bank_owner ON bank_questions(owner_id);
COMMIT;
