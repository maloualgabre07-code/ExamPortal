EXAMPORTAL — APPLE GREEN REFERENCE-MATCH EDITION

This update closely follows the approved mockup:
- Wide school-photo background behind the greeting (no enclosing rounded photo card)
- Compact top bar with the student's initials and identity
- Bright apple green active navigation, simple outlined icons, ornamental school-campus sidebar landscape
- Left-aligned green wave hero with clipboard illustration
- Four horizontal metric cards with vector icons
- Clean, concise overview assessment cards with real examination titles, number of questions, deadlines, and live Start Exam/Resume buttons

The bundled photograph is the ACTUAL school photo from the uploaded ZIP. The earlier AI concept depicts an imagined building; this version deliberately uses the project's genuine campus photo, so the building itself cannot be pixel-identical to the reference.

Security and functionality:
- No changes to DB schema, backend, API endpoints, session handling, or SEB security.
- Exam actions remain tied to their existing data-action handlers.
- Only overview card presentation (not examination logic), CSS, and decorative SVG assets were changed.
- Uses local assets; no internet required to display the design.

Installation:
1. Back up your existing ExamPortal folder.
2. Unzip this version to a DIFFERENT folder.
3. Copy your original working .env file into the new folder (do not share it publicly).
4. Open the new folder in VS Code.
5. npm install
6. npm start
7. In Chrome, open http://localhost:3000 and hard-refresh with Ctrl+Shift+R.

Verification:
node --check public/app.js
node --check server.js
node --test test/logout-ui.test.js test/seb-security.test.js
Nine selected regression tests passed when packed.
A live PostgreSQL end-to-end test and visual browser check with a signed-in account were not performed here.
