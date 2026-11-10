EXAMPORTAL — AUTOMATIC EXAM SUBMISSION ON FOCUS LOSS

Changes: public/app.js and app.js (backend). No schema or database migration.

Behavior: While a student is in a live attempt, switching tabs, minimizing Chrome, or focusing another application sends a request to automatically submit the attempt with current answers. The backend grades it and records an attempt.focus_violation event in exam_audit. Repeated requests are idempotent.

LIMITATION: Chrome cannot reliably detect taking screenshots. Windows Snipping Tool may cause the browser to lose focus, but this cannot be guaranteed; it is not a screenshot detector.

CAUTION: OS dialogs, notification popups, accessibility tools, or network problems can cause accidental terminations or submission delays. Tell students the rule before enabling it. Test with a dummy student and exam first. A client-side-only trigger is not tamper-proof.

INSTALLATION: Back up the project. Copy app.js into the root project directory and public/app.js into public/; keep your existing .env file. Restart npm start; refresh browser with Ctrl+F5. Ensure that all updated files come from this package. No database changes required.

TEST: Start a dummy exam, answer a question, switch tabs, return. It should show the completed review. Check pgAdmin public.exam_attempts for status submitted and public.exam_audit for action attempt.focus_violation. Do not test with an important exam.
