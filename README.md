# Civil AI — Engineering Platform (MVP)

A bilingual (Arabic/English), responsive static engineering web app.

## Features
- Simply supported beam: full-span UDL or midspan point load; reactions, max shear and moment.
- Rectangular concrete volume, waste allowance and estimated cost.
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
- Concrete estimates are geometric only; no reinforcement, formwork, labor, or mix design calculation.
- All saved data lives in localStorage in the current browser. Clearing browser storage deletes it; export backups regularly.
- Assistant is keyword-based, not generative AI. Never place an API key in frontend JS. Add a backend/API gateway with authentication, usage limits and validation before integrating a model.
- Calculations are for preliminary/educational use and must be independently verified by a qualified engineer.

## Next version
Authentication, cloud database, project drawings/PDF upload, more structural cases, verified design-code modules, and an AI backend.
