<div align="center">

# Draftline — AI Writing Studio

**A full-stack AI writing workspace with Gemini-powered generation, secure accounts, and a transactional credit system.**

[![CI](https://github.com/matiur25580/ai-saas-generator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/matiur25580/ai-saas-generator/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-555?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47a248?logo=mongodb&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Gemini-4285f4?logo=google&logoColor=white)

[**Open the app**](https://ai-saas-generator.vercel.app) · [**API health**](https://ai-saas-generator-d3g8.onrender.com/api/health) · [**Screenshot guide**](docs/screenshots/README.md)

</div>

---

## Product overview

Draftline is a React and Express writing studio that turns user prompts into formatted content with the Google Gemini API. It combines a configurable writing experience with account verification, saved content, bookmarks, and a credit ledger.

The application supports two modes of use:
- **Guest workspace:** generate content and keep guest history in the browser.
- **Signed-in workspace:** manage account-backed generation history, bookmarks, credit balance, and transaction records.

For account workflows, Draftline uses Brevo to deliver one-time passcodes (OTPs). MongoDB stores user, content, OTP, and credit data.

> **Project status:** Draftline is an actively developed portfolio application with a deployed frontend and API. Core generation, account, content, and credit workflows are implemented. Real Gemini, Brevo, and MongoDB behavior depends on correctly configured external services. The public demo is not a production writing service; use synthetic test data only. Paid plans, checkout, customer testimonials, and public analytics are not implemented.

## What you can do

### Write with AI
- Generate text through the Gemini REST API.
- Choose content format, persona, tone, output length, and temperature.
- Handle provider/model failures with explicit unavailable responses rather than fabricated placeholder output.
- Copy generated content, download Markdown or text, and use browser print-to-PDF.

### Manage an account and content
- Register and verify an account with a six-digit email OTP.
- Sign in, recover a password, and sign out.
- Browse searchable, paginated generation history.
- Bookmark, edit, and delete saved content.
- Review account credits and a transaction history.

### Operate the credit workflow
- Grant starter credits and support admin-issued credit grants.
- Reserve a credit before an authenticated generation request.
- Settle the reservation with saved output on success.
- Refund failed generation or persistence attempts transactionally.
- Reconcile stale reservations after an interrupted process, with bounded retry batches and duplicate-refund protection.

### Use a responsive workspace
- Responsive landing, authentication, studio, and admin screens.
- Light and dark workspace themes.
- Clear request feedback and structured API errors.

## Engineering highlights

The project focuses on correctness at security- and money-adjacent boundaries:

- **Session lifecycle:** short-lived access tokens remain in frontend memory; rotating refresh tokens are held in HttpOnly cookies.
- **CSRF protection:** browser refresh and logout flows require a CSRF token.
- **Session revocation:** database-checked token versions allow logout, password reset, and account deactivation to invalidate existing access sessions.
- **OTP safeguards:** HMAC-protected OTP handling, hashed storage, expiry, attempt lockout, enumeration-resistant responses, and MongoDB-shared rate limits.
- **Atomic credit accounting:** balance updates and ledger entries are committed in MongoDB transactions.
- **Generation recovery:** pending reservations older than 30 minutes are scanned every minute; each pass is bounded to 100 reservations and failed refunds can be retried.
- **API hardening:** Helmet, allowlisted CORS, request validation, structured errors, request logging, and health/readiness status.

AI matching and generated text are decision-support or drafting aids. Users remain responsible for reviewing output before relying on it.

## Technology

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite 8, JavaScript |
| UI | Lucide React, DM Sans, Space Grotesk |
| Backend | Node.js, Express 4 |
| Data | MongoDB Atlas, Mongoose |
| Authentication | JWT, HttpOnly refresh cookies, CSRF token |
| Email | Brevo HTTP API |
| AI | Google Gemini REST API |
| Hosting | Vercel (frontend), Render (API) |
| Automation and tests | GitHub Actions, Node test runner, MongoDB replica-set integration tests |

## Architecture

```text
Browser
  |
  +-- React + Vite (Vercel)
  |     +-- UI state and guest history
  |     +-- In-memory access token
  |     +-- HttpOnly refresh cookie + CSRF header
  |
  +-- JSON API requests
        |
        v
      Express API (Render)
        +-- Authentication and session controls
        +-- Generation and credit reservation
        +-- Content history and admin routes
        +-- Google Gemini REST API
        +-- Brevo HTTP API (OTP email)
        +-- MongoDB Atlas
              +-- Users and sessions
              +-- OTP state
              +-- Saved content
              +-- Credit balances and ledger
              +-- Rate-limit counters
```

Guest history stays in the browser. Signed-in content, balances, OTP state, and credit transactions are persisted in MongoDB.

For authenticated generation, the API reserves one credit before calling Gemini. A successful provider response and its saved content settle the reservation transactionally. Provider or persistence failures trigger a transactional refund. A periodic reconciliation scan recovers stale reservations left by abrupt process termination.

## Repository layout

```text
.
├── frontend/
│   ├── src/
│   └── package.json
├── backend/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── scripts/
│   └── package.json
├── docs/
│   └── screenshots/
└── .github/
    └── workflows/
        └── ci.yml
```

## Run locally

### Requirements

- Node.js 20.19 or newer
- npm
- MongoDB with replica-set transaction support (MongoDB Atlas or a local replica set)

### 1. Clone and install

```bash
git clone https://github.com/matiur25580/ai-saas-generator.git
cd ai-saas-generator

npm --prefix backend ci
npm --prefix frontend ci --legacy-peer-deps
```

The frontend install uses `--legacy-peer-deps`, matching the repository's CI workflow.

### 2. Configure environment

Create the local environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set values in `backend/.env`:

```dotenv
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=verified_sender@example.com
TRUST_PROXY_HOPS=0
```

Set the frontend API origin in `frontend/.env`:

```dotenv
VITE_BACKEND_URL=http://localhost:5000
```

Gemini credentials are needed for live generation. Brevo credentials are needed for signup and password-reset email delivery. Never commit real secrets or put backend credentials in frontend environment variables.

### 3. Start the services

Run the backend in one terminal:

```bash
cd backend
npm start
```

Run the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API listens on [http://localhost:5000](http://localhost:5000); its health endpoint is [http://localhost:5000/api/health](http://localhost:5000/api/health).

## Production configuration

Configure these values in the backend hosting environment:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string; replica-set transactions are required for credit operations |
| `JWT_SECRET` | Long, random signing secret for access and refresh tokens |
| `GEMINI_API_KEY` | Google AI API key, sent in the `x-goog-api-key` header |
| `BREVO_API_KEY` | Brevo API key for OTP delivery |
| `BREVO_SENDER_EMAIL` | Verified Brevo sender address |
| `FRONTEND_URL` | Exact HTTPS frontend origin allowed by CORS |
| `TRUST_PROXY_HOPS` | Trusted reverse-proxy depth for client IP derivation |
| `NODE_ENV` | Set to `production` in production |
| `PORT` | Supplied by the hosting platform |

Brevo configuration is required for OTP delivery but is optional for backend startup. The backend uses Brevo's HTTP API; Gmail SMTP is not used.

Set `VITE_BACKEND_URL` in the Vercel frontend environment to the backend origin. If using a custom frontend domain, set `FRONTEND_URL` to that exact origin. Wildcard CORS origins are not accepted.

The server prioritizes `gemini-3.8-flash` when available and limits each generation to three text-capable Flash model attempts, with a 30-second timeout per attempt.

### Existing database: OTP TTL index migration

If deploying to a database that still has the previous OTP TTL index, apply this one-time migration:

```javascript
db.otps.dropIndex('createdAt_1')
db.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

OTP documents use `expiresAt` so an incorrect-code lock remains stored for the full ten-minute lock period.

## API overview

All endpoints are mounted under `/api`. Responses include a `success` flag and a `data` payload or structured `error`/`code`.

### Authentication

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/send-otp` | Send signup or reset OTP |
| POST | `/auth/register` | Verify signup OTP and create account |
| POST | `/auth/login` | Sign in and issue access/refresh session |
| GET | `/auth/csrf` | Issue or retrieve browser CSRF token |
| POST | `/auth/refresh` | Rotate refresh cookie and issue access token |
| POST | `/auth/logout` | Revoke sessions and clear cookies |
| POST | `/auth/reset-password` | Reset password and revoke existing sessions |
| GET | `/health` | API/database readiness |

OTP values expire after three minutes; five incorrect submissions lock an OTP for ten minutes. OTP sending is limited to three requests per email and 30 per IP per ten minutes. The endpoint returns the same generic `202` response for eligible and ineligible accounts.

### Content, generation, and credits

| Method | Route | Purpose |
|---|---|---|
| POST | `/generate` | Generate text; signed-in requests reserve a credit |
| POST | `/content` | Save authenticated content and debit one credit |
| GET | `/content?page=1&search=...` | Search and paginate saved history |
| PUT | `/content/:id` | Update the caller's content |
| DELETE | `/content/:id` | Delete the caller's content |
| GET | `/content/transactions?page=1` | Read the credit ledger |

Protected routes use `Authorization: Bearer <access-token>`. The frontend keeps access tokens in memory, not local storage. Refresh cookies are HttpOnly and rotated with a CSRF-protected request.

### Admin

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/stats` | Read admin-only user and generation statistics |
| POST | `/admin/add-credits` | Grant credits to an account |

Public registration always creates a standard user; clients cannot request an administrator role. Bootstrap the initial administrator once from the backend directory:

```bash
cd backend
node scripts/bootstrap-admin.js
```

Configure `MONGO_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (16–128 characters), with optional `ADMIN_NAME`, in the backend environment first. The bootstrap command uses a one-time marker and rejects a second run. Keep the admin password in a secret manager.

## Tests and CI

Run the available checks:

```bash
# Frontend production build
cd frontend
VITE_BACKEND_URL=http://localhost:5000 npm run build

# Backend tests and dependency audit
cd ../backend
npm test
npm audit
node --check server.js
```

The GitHub Actions workflow:
- Installs frontend and backend dependencies.
- Builds the frontend.
- Checks backend JavaScript syntax.
- Starts MongoDB 7 as a replica set.
- Runs the backend test suite against the replica set.
- Reports dependency advisories.

Backend tests cover authentication and refresh rotation, token-version revocation, OTP lockout and enumeration behavior, shared rate-limit concurrency, credit reservation/refund logic, duplicate-refund protection, concurrent last-credit spending, stale-reservation recovery, API error contracts, and Gemini model failover. Database-backed integration and end-to-end tests are skipped locally when `MONGODB_TEST_URI` is not configured. CI supplies a MongoDB replica-set test URI.

A separate manually dispatched **Staging Authentication Smoke Test** checks readiness, login, refresh-cookie issuance and rotation, logout, and revoked-token rejection. It must target a dedicated staging deployment and test account; the workflow refuses the production Render API hostname. It does not create users, send OTP emails, or call Gemini.

Passing CI verifies only the checks automated in that workflow. It does not prove that live Brevo email delivery, Gemini generation, or production deployment configuration is working.

## Security and operational notes

- Passwords are hashed; access and refresh tokens are signed with the backend secret.
- Refresh cookies are HttpOnly; browser refresh/logout requests include a CSRF token.
- Each protected request checks the current account state and token version.
- Logout, password reset, and account deactivation invalidate existing access sessions.
- OTP data is stored in hashed/HMAC-protected form with expiry and attempt lockout.
- Rate limits use atomic MongoDB-backed counters shared across backend instances; stored IP and email identifiers are SHA-256 hashed.
- CORS uses explicit allowed origins, and the backend uses Helmet, validation, structured errors, and request logs.
- Credit balances and ledger records are updated transactionally.
- Resume-like or private user content should never be used as demo data; use synthetic content in screenshots and smoke tests.

## Deployment and live demo

- **Frontend:** [ai-saas-generator.vercel.app](https://ai-saas-generator.vercel.app)
- **Backend:** [ai-saas-generator-d3g8.onrender.com](https://ai-saas-generator-d3g8.onrender.com)
- **API health:** [Check backend health](https://ai-saas-generator-d3g8.onrender.com/api/health)

The frontend and API are deployed separately. The app depends on environment variables and external MongoDB, Gemini, and Brevo services; availability of the public URLs alone does not guarantee every integration is configured or operational.

## Screenshots

A real screenshot gallery is not included yet. The [screenshot guide](docs/screenshots/README.md) lists the captures to add:

1. Public landing page.
2. Signed-in writing studio and generation controls.
3. Saved content history and credit ledger.

Only add screenshots captured from the running application with synthetic demo data. Do not use mockups or expose names, email addresses, OTPs, tokens, API keys, or private content.

## Learning path

For a focused code walkthrough, follow this order:

1. Frontend entry point, routes, and API client.
2. Authentication, OTP, refresh-cookie, and CSRF flow.
3. Express server bootstrap and route handlers.
4. MongoDB models for users, content, OTPs, and credits.
5. Generation reservation, settlement, refund, and reconciliation.
6. Gemini and Brevo integration boundaries.
7. CI workflow and staging smoke test.

## License

The backend package currently declares `ISC`; check the repository's root-level licensing files before reusing or redistributing the complete project.

---

## Author

**Matiur Rahaman** · Full-Stack Developer

- GitHub: [@matiur25580](https://github.com/matiur25580)
- Email: [rahamanmatiur397@gmail.com](mailto:rahamanmatiur397@gmail.com)

Built with React, Vite, Node.js, Express, MongoDB, Gemini, and Brevo.
