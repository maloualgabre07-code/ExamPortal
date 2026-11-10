# ExamPortal — Online Examination System

A web-based Online Examination System developed as a full-stack academic project using Node.js, Express.js, and PostgreSQL. ExamPortal provides a centralized platform for managing examinations, classes, questions, student assessments, and examination results.

## Project Overview

ExamPortal is designed to simplify the examination process by providing instructors with tools to create and manage examinations while allowing students to participate in assessments and review their results.

The system includes user authentication, class management, question bank management, examination scheduling and assessment, automatic scoring, and administrative functions.

## Key Features

### 1. User Authentication and Account Management
- Login and authentication for Admin, Instructor, and Student accounts.
- Student self-registration.
- Session-based authentication.
- Password hashing and account security.
- Password reset functionality.

### 2. Examination Management
- Create, manage, and administer examinations.
- Multiple-choice questions.
- True or False questions.
- Identification questions.
- Enumeration questions.
- Mixed question types.
- Examination timers and automatic submission.
- Automatic scoring for supported question types.

### 3. Question Bank Management
- Centralized question bank.
- Organize and manage examination questions.
- Randomized question selection.
- Randomized answer options.
- Support for different question formats.

### 4. Class Management
- Instructors can manage their classes.
- Students can join classes using class join codes.
- Class membership management.
- Examination access based on class enrollment and configured requirements.

### 5. Results and Assessment
- Automatic assessment and scoring.
- Student examination results.
- Examination history and performance information.

### 6. AI-Assisted Question Generation
- Optional AI-assisted question generation.
- Supports generating examination questions in batches.
- Configured maximum generation limit of 100 questions.

*AI-assisted generation requires the appropriate external AI service configuration.*

### 7. Examination Security
- Session-based access control.
- Examination integrity checks.
- Safe Exam Browser (SEB) support.
- Browser-compatible examination deterrents.

**Note:** Standard web browsers cannot guarantee complete prevention of operating-system-level screenshots. Stronger examination restrictions require a supported secure examination environment such as SEB.

## User Roles

| User Role | Responsibilities |
|---|---|
| Administrator | Manages system administration and user accounts. |
| Instructor | Manages classes, questions, and examinations. |
| Student | Joins classes, takes examinations, and views results. |

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js |
| Web Framework | Express.js |
| Database | PostgreSQL |
| Database Driver | node-postgres (pg) |
| Authentication | Express Session, bcryptjs |
| Session Storage | connect-pg-simple |
| Environment Configuration | dotenv |
| Development Environment | Visual Studio Code |

## Database Information

ExamPortal uses PostgreSQL as its relational database management system.

The database stores information related to:

- User accounts and authentication.
- Classes and student enrollment.
- Examination records.
- Questions and answer options.
- Student examination attempts.
- Assessment results.
- Password reset records.

The project includes `schema.sql` and database migration scripts for database structure and upgrades.

## Installation and Setup

### Prerequisites

Install the following before running the application:

- Node.js
- npm
- PostgreSQL
- Git

### Step 1 — Clone the Repository

```bash
git clone https://github.com/maloualgabre07-code/ExamPortal.git
```

### Step 2 — Open the Project Directory

```bash
cd ExamPortal
```

### Step 3 — Install Dependencies

```bash
npm install
```

### Step 4 — Configure Environment Variables

Create a local `.env` file in the project root directory.

Configure the PostgreSQL database connection and other required environment variables according to the application's configuration in `db.js` and `server.js`.

Never upload actual database passwords, session secrets, API keys, or other private credentials to GitHub.

### Step 5 — Prepare the Database

Make sure PostgreSQL is running and the configured database is available.

Run the project's setup command when preparing a new local installation:

```bash
npm run setup
```

Follow the setup output and verify that the database connection and required tables are ready.

### Step 6 — Start the Application

```bash
npm start
```

### Step 7 — Open the Application

Visit the following address in your browser:

```text
http://localhost:3000
```

## Project Structure

```text
ExamPortal/
│
├── migrations/          # Database migrations
├── public/              # Frontend files and assets
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── scripts/             # Setup and database upgrade scripts
├── test/                # Automated tests
│
├── .gitignore
├── package.json
├── package-lock.json
├── question-bank.js
├── question-types.js
├── randomize.js
├── schema.sql
├── seb-security.js
└── server.js
```

## Running Tests

The project uses Node.js's built-in test runner.

To execute the Safe Exam Browser security tests:

```bash
node --test test/seb-security.test.js
```

Other automated tests are available in the `test/` directory.

## Development Information

**Project Name:** ExamPortal — Online Examination System

**Project Type:** Full-Stack Web Application

**Primary Technologies:** Node.js, Express.js, PostgreSQL

**Repository:** https://github.com/maloualgabre07-code/ExamPortal

**Repository Visibility:** Public

## Academic Project

Developed as an academic project for the Bachelor of Science in Information Technology (BSIT) program.

This project demonstrates the application of full-stack web development, relational database management, authentication, examination management, and software testing.

---

*ExamPortal — A centralized platform for online examinations and assessment management.*
