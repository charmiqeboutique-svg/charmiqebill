<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# CHARMIQE Boutique POS & Billing

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/80f0f7e9-c2f3-41ae-9669-beebb9cd3240

## Run locally with PostgreSQL

Prerequisites: Node.js and a PostgreSQL database.

1. Install dependencies with `npm install`.
2. Create a database named `charmiqe_pos` (or choose another name).
3. Create a `.env` file in the project root and set `DATABASE_URL` to the PostgreSQL connection string. For local PostgreSQL, start from the example in `.env.example` and set `PGSSLMODE=disable`. Managed PostgreSQL providers commonly require `PGSSLMODE=require`.
4. Set `GEMINI_API_KEY` if you use the Gemini-powered features.
5. Run `npm run dev`.

The server creates the PostgreSQL tables on startup. On the first PostgreSQL run, it imports the existing `data/invoice-state.json` snapshot when present; otherwise, it seeds PostgreSQL with the project's initial data. Successful API changes are committed to PostgreSQL before the server responds. PostgreSQL is required; the app does not silently fall back to in-memory storage.
