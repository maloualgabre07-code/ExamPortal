EXAMPORTAL - MODERN APPLE GREEN CAMPUS EDITION
=============================================

WHAT CHANGED
- Redesigned dashboard with the actual bundled BCC campus photograph.
- Apple green and white design, rounded modern cards and controls.
- Fresh sidebar, logo presentation, assessment cards and stat icons.
- Styled login and retained responsive mobile layout.
- Kept existing app API calls, examination actions, class functions,
  instructor/admin pages, Safe Exam Browser hooks and database schema.
- All displayed counts are sourced from existing application data.

HOW TO USE ON YOUR WINDOWS COMPUTER
1. Make a backup copy of your currently working ExamPortal folder.
2. Extract this ZIP into a separate folder.
3. In your current working ExamPortal folder, keep your own .env file,
   database setup and any local secrets. These are not included here.
4. Open the extracted project in VS Code.
5. In its terminal, run npm install (only if dependencies are missing),
   then npm start. Open http://localhost:3000 in Chrome.
6. Press Ctrl+Shift+R if Chrome still displays an older stylesheet.
7. Verify login, dashboard, classes, exams and SEB on your machine.

IMPORTANT
- The included campus image is the photograph already in the source ZIP,
  not the AI-made campus building shown in the earlier design concept.
- This package has not been validated against a live PostgreSQL database.
- This ZIP did not include .env, node_modules or a running database.
- Existing database records are not modified.
- If your original project had newer changes after this ZIP was created,
  merge carefully rather than overwriting those newer files.

KEY MODIFIED FILES
public/app.js (overview HTML only, plus visual stat markup)
public/style.css (new appended visual design layer)
