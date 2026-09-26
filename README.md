# Feedants Competition Details

A React Native competition details screen backed by a Node.js, Express, and MongoDB API. Competition content, availability, lifecycle state, registration, payment status, and submissions come from the API. The screen follows the supplied Feedants design and includes registration, a development payment confirmation, and video URL submission.

## Requirements

- Node.js 20 or newer
- MongoDB (local instance or hosted URI)
- Expo-compatible iOS simulator, Android emulator, or device

## Run the backend

1. In `backend/`, copy `.env.example` to `.env` and set `MONGODB_URI` if your MongoDB connection differs from the local default.
2. Install backend packages with `npm install`.
3. Seed the sample competition with `npm run seed`.
4. Start the API with `npm start`.

The API listens on port `4000`. The seed creates the `classical-dance` competition with an open registration period, dates in the future, sample rules, rewards, and judging criteria.

## Run the mobile app

1. In `mobile/`, copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to the API address reachable from the app. Use `http://localhost:4000/api/v1` for an iOS simulator, `http://10.0.2.2:4000/api/v1` for the Android emulator, or your computer's LAN address for a physical device.
3. Install mobile packages with `npm install`.
4. Start Expo with `npm start` and open the app on your simulator/device.

The app uses `classical-dance` by default. Override it with `EXPO_PUBLIC_COMPETITION_ID` when testing another competition. Pull down on the details page to refresh the server state.

## API overview

The full API reference and configuration notes are in [backend/README.md](backend/README.md). Main routes are `GET /api/v1/competitions/:slug`, `POST /api/v1/competitions/:slug/register`, `POST /api/v1/competitions/:slug/payments/:registrationId/confirm` (development only), and `POST /api/v1/competitions/:slug/submission`.

## Assumptions and decisions

- MongoDB stores competition presentation data separately from user registrations. Registrations have a unique competition/user index; an atomic conditional increment reserves capacity so concurrent requests cannot book beyond the limit.
- Registration holds a place while payment is pending. Only a paid registration may submit. Registration and submission windows may overlap, as the supplied design dates do.
- The mobile app sends a fixed `x-user-id` demo identity to make participation visible without an authentication service. Replace it with a verified session or JWT before production.
- Payment confirmation is simulated in development. Production payment should use a provider and signature-verified, idempotent webhooks.
- Sample judge/winner photos and video links are optional in the data model; the screen uses initials and clear placeholders when media URLs are absent.
- The referral action uses the native share sheet; the review, ad, and bottom navigation areas are presentational because no corresponding services or screens were supplied.

## Trade-offs and future production work

The demo keeps the UI and API small enough to review while preserving server-authoritative lifecycle and capacity checks. The sample identity and development payment route are intentionally not production authentication or payment integrations. Before production, add verified authentication, payment/refund webhooks, an operational expired-hold worker with counter reconciliation, media upload/storage, localization, observability, and automated API/mobile tests. A screen recording can be captured after installing dependencies and running the app locally.
