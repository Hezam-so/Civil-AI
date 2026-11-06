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
