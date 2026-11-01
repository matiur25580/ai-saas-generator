# Draftline — AI Writing Studio

Draftline is a React and Express writing workspace that sends real content requests to Google Gemini, verifies accounts through Brevo email, and stores signed-in history and credit events in MongoDB.

![React](https://img.shields.io/badge/React-18-149eca) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![Express](https://img.shields.io/badge/Express-4-555) ![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47a248) ![AI](https://img.shields.io/badge/AI-Gemini-4285f4)

## Live Links

- Frontend: [https://ai-saas-generator.vercel.app](https://ai-saas-generator.vercel.app)
- Backend: [https://ai-saas-generator-d3g8.onrender.com](https://ai-saas-generator-d3g8.onrender.com) (API health: [/api/health](https://ai-saas-generator-d3g8.onrender.com/api/health))

## Screenshots

Capture and add current production screenshots here after deployment:

- Landing page: `docs/screenshots/landing.png` (placeholder)
- Writing studio: `docs/screenshots/studio.png` (placeholder)
- Account history and credits: `docs/screenshots/account.png` (placeholder)

## ✨ Features
- 🔐 JWT Auth + 6-digit OTP verification
- 🤖 Live Gemini text generation with format, persona, tone, length, and temperature controls
- 🔐 HMAC-protected, Brevo-delivered signup/reset OTP, lockout, layered rate limits, and rotating HttpOnly refresh cookies
- 📚 Account-backed generation history, search, pagination, bookmarks, and delete
- 💳 Transactional credit ledger for starter-credit grants, generation debits, and admin grants
- 📄 Copy, Markdown/text download, and safe browser print-to-PDF
- 🌗 Light/dark workspace and responsive landing, auth, studio, and admin screens
- 🛡️ Helmet, allowlisted CORS, validation, structured errors, request logs, and health status

Paid plans, checkout, customer testimonials, and public analytics are not implemented or advertised.

## 🛠️ Tech Stack
**Frontend:** React 18, Vite 8, Lucide, DM Sans, Space Grotesk
**Backend:** Node.js, Express 4, Mongoose, JWT, Brevo HTTP API
**Database:** MongoDB Atlas
**AI:** Google Gemini REST API
**Deploy:** Vercel + Render

## ⚙️ Setup

Requirements: Node.js 20.19+ and MongoDB Atlas (replica set/transaction support).

```bash
git clone https://github.com/matiur25580/ai-saas-generator.git
cd ai-saas-generator
npm --prefix backend install
npm --prefix frontend install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set valid development values in `backend/.env` and `frontend/.env`, then run each service in a separate terminal:

```bash
cd backend && npm start
```

```bash
cd frontend && npm run dev
```

The frontend is served at `http://localhost:5173`; the API listens on `http://localhost:5000`.

## Architecture

```text
Browser (React + Vite)
	├── JSON API + HttpOnly refresh cookie ──> Express API (Render)
	│     ├── JWT access/refresh sessions
	│     ├── Gemini REST API (text generation)
	│     ├── Brevo HTTP API (OTP email)
	│     └── MongoDB Atlas (users, content, OTPs, credit ledger)
	└── Static frontend assets (Vercel)
```

Frontend state and guest history stay in the browser. Signed-in content, account balances, OTP state, and credit transactions are persisted in MongoDB. Authenticated generation debits a credit and saves its content/ledger entry in one transaction.

## Production Environment

Set these variables in the backend deployment. Production startup fails fast if a required service configuration is absent:

- `MONGO_URI`: MongoDB Atlas connection string. Atlas must support replica-set transactions for credit changes.
- `JWT_SECRET`: long, random secret used to sign access and refresh tokens.
- `GEMINI_API_KEY`: Google AI API key. The server prioritizes `gemini-3.8-flash` and only discovers flash models that support text output.
- `BREVO_API_KEY` and `BREVO_SENDER_EMAIL`: Brevo API key and a verified sender address. Gmail SMTP is not used.
- `FRONTEND_URL`: the exact HTTPS Vercel origin, for example `https://your-project.vercel.app`. CORS does not accept wildcard origins.
- `NODE_ENV=production` and `PORT` as supplied by the host.

Set `VITE_BACKEND_URL` in the frontend deployment to the backend origin. A production build emits a warning when this value is missing. `FRONTEND_URL` must exactly match the deployed Vercel origin.

### OTP TTL Index Migration

OTP documents use `expiresAt` so an incorrect-code lock remains in the database for the full ten minutes. Before deploying this schema change to a database that already has the old TTL index, remove it once in MongoDB:

```javascript
db.otps.dropIndex('createdAt_1')
db.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

## API Reference

All API responses use a `success` boolean and a `data` payload or structured `error`/`code`. Auth endpoints retain selected top-level fields for compatibility.

### Authentication

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/send-otp` | Send signup/reset OTP. Limited to 3 requests per email per 10 minutes. Requires `{ email, purpose, name? }`. |
| `POST` | `/api/auth/register` | Verify signup OTP and create account. Requires `{ name, email, password, otp }`; password is 8-128 characters. |
| `POST` | `/api/auth/login` | Login, limited to 5 attempts per IP per 15 minutes. Returns a 15-minute access token and sets a rotating 7-day HttpOnly refresh cookie. |
| `POST` | `/api/auth/refresh` | Rotate the refresh cookie and return a new access token. Send cookies with credentials enabled. |
| `POST` | `/api/auth/logout` | Revoke the current refresh token and clear its cookie. |
| `POST` | `/api/auth/reset-password` | Verify reset OTP and set a new password. Requires `{ email, otp, newPassword }`. |
| `GET` | `/api/health` | Readiness check; returns 503 with `DATABASE_UNAVAILABLE` until MongoDB connects. |

Five incorrect OTP submissions lock that OTP for ten minutes. OTPs expire after three minutes.

### Generation, Content, and Credits

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/generate` | Generate text. Accepts `{ prompt, persona?, aiTone?, contentType?, outputLength?, temperature? }`; returns `AI_UNAVAILABLE` instead of placeholder output if all models fail. Signed-in generations are saved and debit one credit. |
| `POST` | `/api/content` | Authenticated content save and one-credit debit. Requires `{ prompt, response, persona?, tone?, bookmarked? }`. |
| `GET` | `/api/content?page=1&search=...` | Authenticated, paginated content history. |
| `PUT` | `/api/content/:id` | Update the caller's content record. |
| `DELETE` | `/api/content/:id` | Delete the caller's content record. |
| `GET` | `/api/content/transactions?page=1` | Authenticated credit ledger, newest first. Positive amounts are grants; negative amounts are debits. |

Authenticated routes require `Authorization: Bearer <access-token>`. Credit balance changes and their ledger records are committed in one MongoDB transaction.

### Admin

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/stats` | Admin-only user and generation statistics. |
| `POST` | `/api/admin/add-credits` | Admin-only manual credit grant. Requires `{ email, credits }`, where credits is an integer from 1 to 100000. |

OTP requests are limited to 3 per email and 15 per IP per 10 minutes; generation is limited to 20 requests per account or guest IP per 15 minutes. Login is limited to 5 attempts per IP per 15 minutes. Rate limits use the in-memory express-rate-limit store. Configure a shared store before running multiple backend instances.

## Verification

```bash
cd frontend && VITE_BACKEND_URL=http://localhost:5000 npm run build
cd ../backend && npm audit && npm start
```

The repository does not include credentials for Brevo, Gemini, or MongoDB. Live signup/reset email, model generation, and transaction flows must be verified against configured services before presenting a deployed demo.
