# FLOWS — Upload + Model Fix

- Users can **upload images** (no URLs) → `/api/upload` (Vercel Blob).
- All Runway video calls map unsupported model selections (e.g., **Gen‑3 Alpha/Turbo**) to **`gen4_turbo`** automatically.
- Ratios supported: `768:1280`, `1280:720`, `1280:768`, `1024:1024`.

Env Vars (Preview + Production):
- `OPENAI_API_KEY`
- `RUNWAY_API_KEY`
- `BLOB_READ_WRITE_TOKEN`

Deploy: Framework Preset **Other**, Root `./`, Build/Output empty.
