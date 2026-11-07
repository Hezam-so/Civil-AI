# Civil AI — Engineering Platform (MVP)

A bilingual (Arabic/English), responsive static engineering web app.

## Features
- Simply supported beam: full-span UDL or midspan point load; reactions, max shear and moment.
- Concrete volume from length × width or direct measured area × depth, waste allowance and estimated cost.
- Concrete material takeoff using an editable **absolute-volume** mix estimate: cement, water, fine aggregate, coarse aggregate, cement bags, and approximate loose aggregate volumes.
- Optional chemical admixtures, SCM/mineral powders and fibers (24 + 15 + 8 material options), with Arabic/English names and purposes, user-supplied dosages and densities, and total quantities/absolute volumes.
- Supports binder mass replacement by SCM percentage, kg/m³ additional powders, chemical dosage as binder-mass percentage/kg/m³/L/m³, and fibers by kg/m³ or concrete volume percentage.
- Length, force and stress unit conversion.
- Browser-local saved projects with JSON export.
- Rule-based engineering FAQ assistant (NOT an AI model).

## Run locally
Open `index.html` in a modern browser. Alternatively run a local web server:

```bash
cd civil-ai
python -m http.server 8000
```

Visit http://localhost:8000.

## Deploy to Vercel
1. Create a new GitHub repository and upload `index.html`, `styles.css`, `app.js` at the repository root.
2. In Vercel, choose **Add New → Project** and import the GitHub repository.
3. Choose **Other** framework preset. No build command is needed; use repository root as output directory.
4. Deploy. Vercel will provide a public URL; optionally attach your domain.

## Deploy to Netlify
Drag the `civil-ai` folder into Netlify's manual deploy interface, or connect its Git repository. No build step required.

## Limitations and engineering safety
- Structural formulas assume static, linear, simply supported beam, constant span, no self-weight unless explicitly included, and exactly the specified loading case.
- Shear and moment are maximum absolute values; no section capacity, deflection, combinations, or code checks are provided.
- Concrete volume and material quantities are **estimations**, NOT an approved structural mix design: default values are illustrative; verify binder selection, compressive strength, durability, admixture compatibility, air content, moisture corrections, supplier product data and trial batches. Aggregates are modeled on an SSD basis; liquid-admixture water is not deducted from mixing water. Loose aggregate volumes use editable loose bulk densities and are approximate. Material cost breakdown is not included; the existing unit-cost estimate remains.
- Reinforcement, formwork and labor are not included unless manually priced in the concrete m³ unit cost.
- All saved data lives in localStorage in the current browser. Clearing browser storage deletes it; export backups regularly.
- Assistant is keyword-based, not generative AI. Never place an API key in frontend JS. Add a backend/API gateway with authentication, usage limits and validation before integrating a model.
- Calculations are for preliminary/educational use and must be independently verified by a qualified engineer.

## Next version
Authentication, cloud database, project drawings/PDF upload, more structural cases, verified design-code modules, and an AI backend.


## Free engineering AI copilot

The assistant page at `/assistant.html` now defaults to the Vercel AI Gateway free-listed multimodal model `inclusionai/ling-3.0-flash-vl-free` (optionally `reflection/beam-free` through `CIVIL_AI_AI_MODEL`). The server permits only these two explicitly listed free model IDs; there is no automatic paid-model fallback. **Model availability, provider quotas, platform usage limits and free pricing can change without notice.** This does not guarantee unlimited, permanently free requests or free hosting. A valid Vercel AI Gateway authentication context (OIDC or a securely configured gateway API key) and user sign-in are required for chat.

The assistant has an explicit, source-backed guide to the Civil AI tools and pages, proposes navigation/beam-concrete form fill **only after the user confirms** actions, and has deterministic server tools for triangular and polygonal areas, concrete material takeoff, rebar schedules, simple beam deflection, Yemeni area-unit conversion, and existing beam/footing/concrete/section/unit calculators. It can discuss screenshots with a vision-capable model. The direct calculators still work independently of whether an AI provider responds. Studio's inline assistant now calls the same API schema and accepts only PNG/JPEG/WEBP images.

Material quantities use illustrative assumptions; they are not an approved concrete mix design. Beam deflection is linear elastic for simplified boundary/loading assumptions, and land measurements depend on surveyed coordinates. The assistant cannot autonomously read users' locally stored files, run Autodesk Robot/FEM, verify live building-code compliance, or approve structural designs. Validate critical results independently.

To test deterministic tools locally with Node.js: `node tests/civil-advanced.test.js`.


## External AI assistant (OpenRouter free models)

Civil AI now supports an optional external chat provider on the backend. To enable it:

1. Create an API key at https://openrouter.ai/settings/keys using your own OpenRouter account.
2. In Vercel → civilai2026 → Settings → Environment Variables, add **OPENROUTER_API_KEY** as a **secret** for **Production**. Do not paste the key into chat or commit it to GitHub.
3. Redeploy the production branch and open `/assistant.html`. Select the external assistant option and test a normal question in a signed-in session.
4. If you want to pin a listed $0 model with the `:free` suffix, optionally set `CIVIL_AI_OPENROUTER_MODEL`. Otherwise `openrouter/free` selects a free model automatically.

The server refuses paid model IDs and doesn't send provider secrets to the browser. The site prompts for confirmation before navigation or filling supported calculator forms. This is **not** remote desktop control and cannot run arbitrary clicks, file deletion, or engineering programs. Saved projects and privately stored files are not provided to the model automatically.

**Important:** OpenRouter free models have rate limits (at the time of this change, around 50 requests/day without purchased credits). Model availability and tool/vision support can vary; free models are not guaranteed always-on or unlimited. The old Vercel AI Gateway may return HTTP 403 if the team has not completed account verification; OpenRouter avoids that specific gateway but needs its own valid key. If neither provider works, deterministic local help remains available. This is not general-purpose AI.

Owner workflow: verify a live external answer and a confirmed action end-to-end before publicly advertising the model as operational. Do not use model output alone for structural design decisions.
