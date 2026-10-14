# Care Circle backend

NestJS API for authentication and the voice assistant. Account records are demo data held in memory; they reset when the backend restarts. No database server is required.

## Demo accounts

| Account | Email | Password |
| --- | --- | --- |
| Caregiver | `demo@carecircle.test` | `CareCircle123!` |
| Older adult | `olderadult@carecircle.test` | `CareCircle123!` |

Sign-ups are also stored in memory and will be lost when the backend stops. Passwords are hashed in memory.

## Voice assistant

The voice flow sends recordings to the local ASR service, sends the transcript to Groq for a text reply, and uses Expo Speech on the device to speak the reply. There is no separate TTS server.

## Medicine reminders

The scheduler reads medication schedules from the profile module's existing in-memory `MedicationsRepository`. It creates dose history and family alerts in memory and schedules medication jobs in `Africa/Cairo`. Editing, adding, or deleting a profile medication refreshes its scheduler jobs.

Set `MEDICINE_REMINDER_RETRY_SECONDS` and `MEDICINE_REMINDER_MAX_RETRIES` in `.env` to tune reminder retries. Defaults are 600 seconds and 3 retries. For a quick demo, use 5 seconds and 2 retries, then restart NestJS.

Authenticated endpoints: `GET /reminders/today`, `GET /reminders/log`, `POST /reminders/demo-trigger`, `POST /reminders/:doseId/confirm`, and `GET /family-alerts`.

## Run locally

Install the backend packages once with `npm install`. Start the services in separate terminals from the repository root:

1. ASR, from `care-circle-backend`: `.\.venv\Scripts\python.exe -m uvicorn asr_server:app --host 127.0.0.1 --port 8001`
2. NestJS, from `care-circle-backend`: `npm run start:dev`
3. Expo web, from the repository root: `npm run web`

Configure `GROQ_API_KEY`, `GROQ_TEXT_MODEL`, `ASR_SERVICE_URL`, and `AUTH_JWT_SECRET` in the backend `.env`. Set `EXPO_PUBLIC_API_URL` in the root `.env` to the backend address reachable by the device.
