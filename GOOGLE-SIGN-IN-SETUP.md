# Google Sign-In setup

ExamPortal uses a server-side OAuth 2.0 Authorization Code flow with PKCE. Google sign-in is available only to existing active accounts whose stored email matches Google's verified Gmail or Google Workspace email; the account's existing role and password are unchanged.

## Google Cloud configuration

Create an OAuth client with application type **Web application**, and add this authorized redirect URI:

`http://localhost:3000/auth/google/callback`

Set these variables in the existing `.env` file using your Google OAuth client values:

```text
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

Do not share or commit the client secret. Keep the existing database and session settings. Without both client credentials, the Google button stays hidden and email/password sign-in continues to work.

After restarting the server, choose **Continue with Google** and sign in using the verified Gmail or Google Workspace email of an existing active ExamPortal account. New accounts must be created through the normal ExamPortal registration flow first. For another host, register that host's HTTPS callback with Google and set `GOOGLE_REDIRECT_URI` to the same exact URL.
