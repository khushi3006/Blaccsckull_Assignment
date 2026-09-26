# Feedants competition API

Node.js, Express, and MongoDB API for the Competition Details screen. Competition details and lifecycle dates are stored in MongoDB. The API computes the current lifecycle, remaining spots, and signed-in user's registration/submission state from persisted data and server time.

## Setup

1. Install Node.js 20+ and MongoDB.
2. From `backend/`, copy `.env.example` to `.env` and set `MONGODB_URI`.
3. Run `npm install`, then `npm run seed`, then `npm start` (or `npm run dev`). The API listens on port 4000 by default.

The seed creates a demo competition with registration closing in ten days, submissions starting in five days, submissions ending in thirty days, and results in thirty-two days. Registration and submission windows intentionally overlap, as in the supplied design. Rerunning the seed refreshes these demo dates and display content while preserving the booked counter. Seed is idempotent by competition slug.

## API

Base path: `/api/v1`. Success responses use `{ "data": ... }`; errors use `{ "error": { "code", "message" } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/competitions` | List published competitions with lifecycle and remaining spots |
| GET | `/competitions/:slug` | Full detail and optional current user's status |
| GET | `/competitions/:slug/me` | Detail/status for a user (requires `x-user-id`) |
| POST | `/competitions/:slug/register` | Reserve a spot and create a pending payment (requires `x-user-id`) |
| POST | `/competitions/:slug/payments/:registrationId/confirm` | Development-only payment confirmation simulation |
| POST | `/competitions/:slug/submission` | Submit an http(s) video URL (requires `x-user-id`) |
| GET | `/health` | Health check |

The mobile client can send `x-user-id: demo-user` until a real identity provider is connected. This header is an assignment/demo identity adapter, not production authentication; replace it with verified JWT/session middleware before deployment. Payment confirmation is intentionally disabled in production. A real payment provider should confirm payment through a signature-verified webhook and use its event ID for idempotency.

### Registration flow

`POST /competitions/classical-dance/register` atomically increments the competition's booked counter only when the competition is published, registration has not closed, and capacity remains. The unique `{ competition, userId }` index prevents duplicate registrations. It returns a pending-payment registration with a short hold expiry. In development, confirm it with the returned registration ID using the payment route. Only paid registrations can submit, and submissions are allowed once during the submission window.

Lifecycle states are `registration_open`, `registration_closed`, `submission_open`, `submission_closed`, and `results_published`. Registration and submission availability are evaluated independently, so their windows can overlap. All boundaries are determined server-side in UTC. API responses include `serverTime` so clients can render countdowns without treating a client clock as authoritative.

## Data and production notes

Competition documents hold relatively stable display content and an atomic `bookedCount`; registration documents are separate, uniquely indexed user participation records. This avoids growing unbounded arrays on a competition document. Read paths can scale horizontally; capacity reservation uses a conditional single-document MongoDB update, so concurrent requests cannot exceed the configured capacity. Keep MongoDB indexes managed in production (`autoIndex` is disabled when `NODE_ENV=production`).

For a production rollout, connect a verified identity provider, wire payment provider webhooks with idempotency and refund handling, add a durable expired-hold cleanup worker, audit trails, observability, and integration tests. The demo confirmation endpoint and header identity are deliberately small assignment conveniences. Production payment and hold cleanup should be implemented with the selected provider/queue's operational guarantees.
