# Deployment guide

PulseCheck can use Vercel for its Vite dashboard and Render for its FastAPI API. The API needs a persistent PostgreSQL database; do not use the local SQLite default for a hosted deployment. The API also runs an in-process APScheduler, so keep it on one continuously running backend instance to avoid sleeping/stopped schedules or duplicate checks.

## 1. Create the backend and database on Render

1. Create a managed PostgreSQL database in Render and copy its **internal connection URL**.
2. In Render, create a Blueprint from this repository and select `render.yaml` (or create a Python web service manually with the same settings).
3. Set the Blueprint's `PULSECHECK_DATABASE_URL` to the PostgreSQL connection URL. Set `PULSECHECK_CORS_ORIGINS` to the exact Vercel site origin, e.g. `https://your-project.vercel.app` (no trailing slash). Add any custom domain origins as comma-separated values.
4. Use a continuously running instance for scheduled checks. Do not scale this in-process scheduler to multiple API instances.
5. Wait for the service health check at `/health` to pass, then copy the API's public origin, e.g. `https://pulsecheck-api.onrender.com`.

The repository's Render Blueprint deliberately asks for database and CORS values instead of embedding credentials or guessing the final frontend URL.

## 2. Deploy the dashboard on Vercel

1. Import this GitHub repository as a Vercel project. Keep the project root at the repository root; `vercel.json` builds `frontend/` and publishes `frontend/dist/`.
2. Add the environment variable `VITE_API_URL` with the Render API origin, without a trailing slash, e.g. `https://pulsecheck-api.onrender.com`.
3. Deploy. Vite embeds `VITE_API_URL` at build time, so redeploy after changing it.
4. Copy the deployed Vercel origin into Render's `PULSECHECK_CORS_ORIGINS` if it differs from the value entered earlier, then redeploy/restart the API.
5. Verify the dashboard loads and that `/health`, `/api/services`, and dashboard actions work.

## Operational notes

- Local SQLite files are not durable storage for serverless deployments. Use managed PostgreSQL and keep its URL private.
- The API performs outbound requests to user-entered URLs. Do not expose it to untrusted users without authentication and robust SSRF protections.
- This project has no authentication; anyone who can reach the API can manage its monitored services.
