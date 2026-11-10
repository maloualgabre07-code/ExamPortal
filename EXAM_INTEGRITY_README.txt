BCC ExamPortal browser exam-integrity deterrents

Live project changes are in the nested ExamPortal directory:
  app.js
  public/app.js
  public/exam-guard.js
  public/exam-guard.css
  public/index.html
  test/exam-integrity.test.js

Only while a student has an active examination, the page:
- Makes a best-effort attempt to intercept PrintScreen and common platform
  screenshot shortcut key events when the browser exposes them.
- Temporarily covers the page after the exam tab is hidden or the browser
  window loses focus. The timer continues and answers remain in the attempt.
- Displays a subtle, non-interactive repeating watermark with the student's
  name and briefly explains that tab/focus activity may be recorded.
- Sends only tab-hidden and focus-lost event types to an authenticated endpoint.
  The server verifies ownership and active-attempt status and applies a
  per-attempt rate limit. Events are recorded in the existing exam_audit table.

Limitations:
- Browsers cannot reliably block or detect operating-system screenshots,
  screen recording, external cameras, browser extensions, alternate devices,
  or modified browsers. Shortcut interception is best effort only.
- An obscured page is a visual deterrent, not a security boundary; page content
  remains available to a user controlling the device.
- Browser focus/visibility events may be missing or delayed. Their audit trail
  is not proof of misconduct and does not record keystrokes or other browsing.
- This is not a secure proctoring system. Do not describe it as capture-proof.

No database migration is needed. The implementation reuses exam_audit and does
not change .env, passwords, database credentials, or Safe Exam Browser settings.
Keep SEB_REQUIRED=false for normal Chrome examination access.

Tests:
  npm test
  node --test test/exam-integrity.test.js
