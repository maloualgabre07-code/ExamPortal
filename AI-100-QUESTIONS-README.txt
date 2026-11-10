EXAMPORTAL — AI QUESTION GENERATION (UP TO 100)

Changes:
- Instructor AI form now supports 1–100 questions.
- Server generates in batches of up to 10, so 100 questions require ten successful Gemini batches. Smaller responses reduce malformed or incomplete output.
- Invalid/duplicate batch output and transient network/provider failures are retried up to 3 times per batch. Duplicate detection normalizes punctuation and whitespace and checks all earlier batches. Quota and API-key errors are reported immediately.
- The AI generation limit is 100. The separate exam question pool and reviewed bulk-import limit remain 150, preserving existing functionality.
- AI results still require instructor review and explicit saving.
- Existing exam random-subset setting is unchanged (up to 100 per attempt).
- The default model is gemini-2.5-flash for broad compatibility. If GEMINI_MODEL is set in .env, that value overrides the default.
- If Gemini rejects a request, detailed provider errors are logged to the Node terminal. API credentials are not logged.

INSTALLATION:
1. Back up your existing ExamPortal folder and .env file.
2. Stop npm start. Extract ZIP project contents into your existing root (verify package.json and server.js are in root).
3. Keep your existing .env and database; do not overwrite either.
4. Set GEMINI_API_KEY in .env to a valid key, and optionally GEMINI_MODEL=gemini-2.5-flash.
5. Run npm start and try generating 5 questions first, then 100. The number field is capped at 100, and the server rejects requests above 100.
6. Check Node terminal for provider errors if Gemini refuses the model or API quota.
7. If a batch is still invalid after 3 attempts, generation stops without saving a partial draft; the error now identifies the validation problem. Do not paste an existing question bank into the lesson field. Enter topics, concepts, or learning objectives instead.

NOTE: No live Gemini API call was made. Automated tests cover batching, the 100-question cap, and mixed-type distribution. Retries improve recovery but cannot guarantee 100% success because Gemini availability, API quota, network access, and model output are external dependencies. Generated answer keys always need instructor review.
