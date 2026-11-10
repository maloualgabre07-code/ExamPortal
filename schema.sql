BEGIN;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 full_name VARCHAR(100) NOT NULL,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK(role IN ('student','instructor','admin')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS exams (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 instructor_id INTEGER NOT NULL REFERENCES users(id),
 title VARCHAR(150) NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK(duration_minutes BETWEEN 1 AND 180),
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS passing_score INTEGER NOT NULL DEFAULT 75 CHECK(passing_score BETWEEN 0 AND 100);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1 CHECK(max_attempts BETWEEN 1 AND 5);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS exam_questions (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
 prompt TEXT NOT NULL CHECK(length(trim(prompt)) BETWEEN 1 AND 2000),
 options JSONB NOT NULL CHECK(jsonb_array_length(options) BETWEEN 2 AND 4),
 correct_index INTEGER NOT NULL CHECK(correct_index BETWEEN 0 AND 3),
 points INTEGER NOT NULL DEFAULT 1 CHECK(points BETWEEN 1 AND 100),
 position INTEGER NOT NULL,
 UNIQUE(exam_id,position)
);
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
CREATE TABLE IF NOT EXISTS exam_attempts (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 exam_id INTEGER NOT NULL REFERENCES exams(id),
 student_id INTEGER NOT NULL REFERENCES users(id),
 attempt_number INTEGER NOT NULL,
 started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 deadline_at TIMESTAMPTZ NOT NULL,
 submitted_at TIMESTAMPTZ,
 status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','expired')),
 questions JSONB NOT NULL,
 answers JSONB NOT NULL DEFAULT '{}',
 passing_score INTEGER NOT NULL,
 score INTEGER,
 total_points INTEGER NOT NULL,
 UNIQUE(exam_id,student_id,attempt_number)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_attempt ON exam_attempts(exam_id,student_id) WHERE status='in_progress';
CREATE INDEX IF NOT EXISTS attempt_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS exam_instructor ON exams(instructor_id);
CREATE TABLE IF NOT EXISTS exam_audit (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id INTEGER REFERENCES users(id),
 action TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS exam_classes (
 id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 instructor_id INTEGER NOT NULL REFERENCES users(id),
 name VARCHAR(100) NOT NULL CHECK(length(trim(name))>0),
 description VARCHAR(1000) NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(instructor_id,name)
);
CREATE TABLE IF NOT EXISTS class_students (
 class_id INTEGER NOT NULL REFERENCES exam_classes(id) ON DELETE CASCADE,
 student_id INTEGER NOT NULL REFERENCES users(id),
 enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(class_id,student_id)
);
CREATE INDEX IF NOT EXISTS enrollment_student ON class_students(student_id);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS class_only BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS exam_class_assignments (
 exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
 class_id INTEGER NOT NULL REFERENCES exam_classes(id),
 PRIMARY KEY(exam_id,class_id)
);
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

ALTER TABLE exam_classes ADD COLUMN IF NOT EXISTS join_code VARCHAR(16);
CREATE UNIQUE INDEX IF NOT EXISTS class_join_code_unique ON exam_classes(join_code);

ALTER TABLE class_students ADD COLUMN IF NOT EXISTS joined_via_code BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ALTER COLUMN class_only SET DEFAULT TRUE;
UPDATE exams SET class_only=TRUE WHERE class_only=FALSE;

BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS password_reset_codes (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 code_hash CHAR(64) NOT NULL,
 nonce CHAR(32) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 sent_at TIMESTAMPTZ NOT NULL,
 window_start TIMESTAMPTZ NOT NULL,
 sent_count INTEGER NOT NULL CHECK(sent_count BETWEEN 1 AND 3)
);
COMMIT;
