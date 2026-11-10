# BCC ExamPortal — Safe Exam Browser integration (Windows)

This package adds **optional server-side SEB Config Key verification** on student exam routes. It does NOT install Safe Exam Browser, generate a usable `.seb` file, or guarantee that all screen capture methods are blocked. The setting is OFF until explicitly enabled.

## 1. Back up and identify the live project

Your running project is the *inner* `ExamPortal` folder that contains `server.js`, `app.js`, `public/`, and your private `.env`. Do not overwrite `.env` or an existing database. You can copy `seb-security.js`, `app.js`, and `test/seb-security.test.js` from this package into your live project. The updated full ZIP is also included as an alternative; restore your local changes if it is older than your live copy.

## 2. Install Safe Exam Browser

Use https://safeexambrowser.org/download_en.html on the Windows test machine. Launch the **SEB Configuration Tool**. Its exact tab labels can vary by version.

- General: set **Start URL** to the *exact* address students will open, e.g., `http://localhost:3000/` for a one-computer local test. For multiple computers, `localhost` refers to *each student's own machine* and will not reach your server. Configure a reachable HTTPS origin instead.
- Security / Kiosk: use a secure kiosk setting, prevent switching to unauthorized applications, and do not permit unneeded processes. Test accessibility tools and approved accommodations separately.
- Hooked Keys: ensure **Enable Print Screen** is **unchecked**. Disable any other unauthorized shortcut combinations as supported. Do not assume this stops every OS capture route.
- Browser / Exam: turn on **Use Browser Exam Key and Config Key** (send HTTP headers). For Windows, test with a browser engine/version that sends `X-SafeExamBrowser-ConfigKeyHash` on API requests. Some modern engine/platform combinations require SEB's JavaScript API instead of HTTP headers; this patch implements HTTP-header verification only.
- Set a **quit password** known only to the instructor and a separate settings/edit password if supported. Save as an exam-opening `.seb` file, preferably password-protected.
- Reopen your finalized configuration and **copy the Config Key** shown by the SEB Configuration Tool, *after saving*. It is 64 hexadecimal characters. Modifying and resaving the configuration changes the Config Key.

## 3. Configure the ExamPortal server

At the end of your PRIVATE `.env` (in the same directory from which you run `npm start`), add:

```
SEB_REQUIRED=false
SEB_BASE_URL=http://localhost:3000
SEB_CONFIG_KEY=PASTE_FINAL_64_HEX_CONFIG_KEY_HERE
```

First test your saved `.seb` file in SEB while `SEB_REQUIRED=false`. When ready, replace the placeholder with the final Config Key, change `SEB_REQUIRED=true`, save `.env`, and **restart `npm start`**.

`SEB_BASE_URL` must equal the *actual origin used by SEB*, including scheme, hostname, and port. It must have NO trailing pathname or query string. Example for deployment: `https://exams.school.example`. Do not mix `localhost`, `127.0.0.1`, a LAN IP, or HTTP and HTTPS. Each produces different URL-bound hashes.

## 4. What is actually enforced?

When `SEB_REQUIRED=true`, the server rejects student attempts to:
- Start an exam: `POST /api/exams/:id/start`
- Read an attempt: `GET /api/attempts/:id`
- Save answers: `PUT /api/attempts/:id/answers`
- Submit an exam: `POST /api/attempts/:id/submit`

Instructors and administrators can still view attempts in their authorized roles. Normal login and class-management pages work in Chrome, but the protected student exam routes require a matching URL-specific Config Key hash.

For a 403 error *inside SEB*: compare the configured URL, Config Key, browser engine, and whether SEB sends the header on XHR/fetch requests. Use browser/network diagnostics only in an authorized instructor-controlled test environment. Never paste passwords or `.env` values into screenshots.

## 5. Test checklist

- `node --test test/seb-security.test.js` should pass.
- With `SEB_REQUIRED=false`: normal Chrome behavior stays unchanged.
- With `SEB_REQUIRED=true`: Chrome can log in but starting an exam gives HTTP 403.
- In SEB with the final `.seb` configuration: starting an exam, saving answers, refreshing an attempt, and submitting must work.
- Check PrtSc, Win+Shift+S, app switching, Task Manager, remote support/screen-sharing tools, and allowed accessibility tools on each approved Windows version. Record actual results; never report 100% screenshot prevention.
- Test auto-expiry and deadline behavior, as well as loss of internet/power, before an actual exam.

## Security caveats

The hash checks authenticity of a *configured request value*, not the physical device or all running apps. Since HTTP request headers can be reproduced by a sufficiently capable attacker, this is an access-control layer and deterrent—not cryptographic proof that the computer is fully locked down. Keep the `.seb` config protected, use HTTPS with valid certificates in production, supervise high-stakes exams, and consider a properly managed SEB deployment/SEB Server for stronger operational control. Never depend on user-agent sniffing or a static `isSEB=true` flag.

**Privacy and safety:** Don't store passwords/secrets in version control. Rotate any passwords previously exposed in screenshots. Offer an accommodations route for students requiring assistive tools.

Official docs:
- https://safeexambrowser.org/developer/seb-config-key.html
- https://safeexambrowser.org/developer/seb-integration.html
- https://safeexambrowser.org/windows/win_usermanual_en.html
