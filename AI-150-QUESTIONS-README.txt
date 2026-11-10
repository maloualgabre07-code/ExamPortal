EXAMPORTAL — AI QUESTION GENERATION (UP TO 150)

Changes:
- Instructor AI form now supports 1–150 questions.
- Server generates in batches of up to 25 rather than requesting 150 in one model response.
- Exam question pool supports 150 items, including bulk review/save.
- AI results still require instructor review and explicit saving.
- Existing exam random-subset setting is unchanged (up to 100 per attempt).
- The default model is gemini-2.5-flash for broad compatibility. If GEMINI_MODEL is set in .env, that value overrides the default.
- If Gemini rejects a request, detailed provider errors are logged to the Node terminal. API credentials are not logged.

INSTALLATION:
1. Back up your existing ExamPortal folder and .env file.
2. Stop npm start. Extract ZIP project contents into your existing root (verify package.json and server.js are in root).
3. Keep your existing .env and database; do not overwrite either.
4. Set GEMINI_API_KEY in .env to a valid key, and optionally GEMINI_MODEL=gemini-2.5-flash.
5. Run npm start and try generating 5 questions first, then 150.
6. Check Node terminal for provider errors if Gemini refuses the model or API quota.

NOTE: No live Gemini API call was made. The provider may require billing/quota, and generated answer keys always need review.
