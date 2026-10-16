# Care Circle backend

NestJS API for authentication and the voice assistant. Account records are demo data held in memory; they reset when the backend restarts. No database server is required.

## Demo accounts

| Account | Email | Password |
| --- | --- | --- |
| Caregiver | `demo@carecircle.test` | `CareCircle123!` |
| Older adult | `olderadult@carecircle.test` | `CareCircle123!` |

Sign-ups are also stored in memory and will be lost when the backend stops. Passwords are hashed in memory.

## Voice assistant

The voice flow sends recordings to the existing local ASR service, sends the transcript to the existing Groq model for a text reply, then uses the authenticated NestJS `POST /voice/speak` route to request speech audio. ElevenLabs is the active TTS provider by default. STT and Groq reply generation remain unchanged.

### ElevenLabs Arabic TTS

Create an ElevenLabs API key and select an Arabic voice available to your account. Put the key and voice ID in the backend `.env`; the key stays on the server and is never bundled into Expo. The default model is `eleven_v4` for expressive, natural speech and Arabic support. V4 uses ElevenLabs' Text-to-Dialogue WebSocket, returning compressed MP3 audio. This is their quality-focused model; it may take longer than the real-time Turbo or Flash models. The backend caches recent identical audio in memory (up to 24 MB) and coalesces duplicate requests. The Expo client also caches audio on the device.

The Free plan currently includes 10,000 credits per month. API synthesis consumes credits and Free-plan generated content requires attribution and is non-commercial; check your account’s current terms before public or commercial use. ElevenLabs processes reply text as a cloud service.

## Medicine reminders

The scheduler reads medication schedules from the profile module's existing in-memory `MedicationsRepository`. It creates dose history and family alerts in memory and schedules medication jobs in `Africa/Cairo`. Editing, adding, or deleting a profile medication refreshes its scheduler jobs.

Set `MEDICINE_REMINDER_RETRY_SECONDS` and `MEDICINE_REMINDER_MAX_RETRIES` in `.env` to tune reminder retries. Defaults are 600 seconds and 3 retries. For a quick demo, use 5 seconds and 2 retries, then restart NestJS.

Authenticated endpoints: `GET /reminders/today`, `GET /reminders/log`, `POST /reminders/demo-trigger`, `POST /reminders/:doseId/confirm`, and `GET /family-alerts`.

## Caregiver demo link

The seeded caregiver `demo@carecircle.test` is linked to the older-adult profile `olderadult@carecircle.test` through an in-memory caregiver link. The authenticated, caregiver-only `GET /family/overview` endpoint returns that linked profile, medications, contacts, doses, alerts, and submitted health checks. Older-adult health checks are submitted to `POST /health-check` and stored in memory; all in-memory data resets when NestJS restarts. Emergency history remains sample UI data.

## Run locally

Install the backend packages once with `npm install`. Start the services in separate PowerShell terminals:

1. ASR, from `care-circle-backend`: `.\.venv\Scripts\python.exe -m uvicorn asr_server:app --host 127.0.0.1 --port 8001`
2. NestJS, from `care-circle-backend`: `npm run start:dev`
3. Expo, from the repository root: set `EXPO_PUBLIC_API_URL` to your computer's LAN IP, then run `npm run start -- --lan`.

Configure `GROQ_API_KEY`, `GROQ_TEXT_MODEL`, `ASR_SERVICE_URL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, and `AUTH_JWT_SECRET` in the backend `.env`. Set `EXPO_PUBLIC_API_URL` in the root `.env` to the backend address reachable by the device.
