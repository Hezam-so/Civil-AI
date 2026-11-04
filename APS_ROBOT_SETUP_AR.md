# Civil AI — Autodesk CAD/BIM & Robot Viewer

## Scope

This upgrade adds **two genuinely different workflows**:

- **Autodesk APS model viewer** at `/model-viewer.html`, backed by `/api/aps.js`: upload supported CAD/BIM files, translate through APS Model Derivative, display 2D/3D using APS Viewer SDK, inspect object properties, extract a **sample** of up to 800 leaf elements, and export that sample as CSV.
- **Robot Structural CSV viewer** at `/robot-viewer.html`: read exported Nodes and Bars CSV tables from Robot and show a simplified 3D wireframe with element lengths. It does **not** parse native `.rtd` files or read calculated forces.

Existing `/cad-viewer.html` remains a **local, no-upload** ASCII DXF tool. `studio.html` links to all relevant viewers.

## 1. APS setup — required before cloud viewer works

1. Create an app in the [Autodesk Platform Services developer portal](https://aps.autodesk.com/). Confirm that it has the needed Data Management / Model Derivative / Viewer capabilities and that your account is eligible for these services.
2. Open Vercel > your Civil AI project > Settings > Environment Variables.
3. Add **server-only** environment variables:

   - `APS_CLIENT_ID` — APS app Client ID.
   - `APS_CLIENT_SECRET` — APS app Client Secret. Never paste it into a chat, HTML, GitHub, or your front-end JavaScript.
   - `CIVIL_AI_VIEWER_PASSWORD` — a long, unique, unpredictable workspace password (at least 12 characters, recommend 24+).
   
4. Choose **Production** environment for these variables and redeploy your project from Vercel. Preview deployments need separate variable scoping if you intend to test before merge.
5. Open `https://civilai2026.vercel.app/model-viewer.html`. The readiness label checks the server configuration, then you can enter your workspace password, choose a supported design file, and select **رفع وتحويل وعرض النموذج**.
6. If conversion is not ready, choose **تحديث حالة التحويل** later. When successful, the Autodesk Viewer loads. Select an element to inspect attributes. Choose **تقرير خصائص النموذج** to extract a **sample**, then **تصدير CSV**.

**Limits:** 100 MB max per supported file for this prototype, browser performs PUT to APS-issued S3 signed URLs. As this requires browser-to-APS cross-origin upload, browser CORS behavior and service-side policies must be verified with actual credentials; if your browser blocks this, use an authenticated dedicated upload service. Not a production-grade public upload system.

**Security:** The endpoint is protected by one shared workspace password, not a per-user login. Do not publish the password. The server issues access-limited short-lived viewer tokens only after password authorization, but those tokens are still sent to the browser by design. For a public multiuser deployment add proper sessions, authenticated accounts, authorization per project, server-side quotas, logging, upload moderation, secure file isolation, CSRF/rate limits, and budget caps before enabling public use. The temporary APS bucket is not equivalent to an automatic permanent lifecycle cleanup guarantee. Establish an explicit retention/deletion policy. **Autodesk translation is a third-party cloud process and may incur costs.**

## 2. Supported source formats (prototype)

- `.dwg`: AutoCAD and supported Civil 3D drawings.
- `.dxf`: standard DXF.
- `.rvt` / `.rfa`: Revit projects and families, support dependent on version and linked content.
- `.ifc`: IFC BIM data.
- `.nwd` / `.nwc`: Navisworks models.

Cloud translation may fail for unsupported versions, incomplete linked references, Civil 3D object-enabler constraints, or source files that cannot yield a usable viewable. This is not a universal decoder.

## 3. Robot Structural Analysis

Native `.rtd` models are not parsed directly. Export the node and bar tables as CSV **from Robot** with the following columns (rename the headers in a spreadsheet if required):

`nodes.csv`

```csv
id,x,y,z
1,0,0,0
2,6,0,0
3,0,0,3
4,6,0,3
```

`bars.csv`

```csv
id,start,end
1,1,2
2,3,4
3,1,3
4,2,4
```

Open `/robot-viewer.html`. Import both CSV files or click **تحميل نموذج تجريبي** to see how it works. This file stays local; data are not sent to a cloud service.

The viewer shows nodes, bars, approximate projected geometry and lengths in the original coordinate unit. It **does not** display plate/shell elements, connections, releases, load cases, internal forces, stress plots, reinforcement or code checks. Those require separate exported result datasets and further development.

## 4. Engineering limits

**This is a design-document visualizer and metadata extractor, NOT a structural FEM analysis engine.** Properties extracted from an Autodesk derivative are only as complete as the file content and translation. Always confirm geometry, units, origin, layers, constraints and calculations in the original licensed engineering software and against applicable codes before using results for engineering decisions.

## 5. Readiness and smoke tests

- `GET /api/aps?action=health` returns public config readiness (without secrets).
- Without `CIVIL_AI_VIEWER_PASSWORD`, `GET /api/aps?action=viewer-token` must return `401`.
- On Vercel, set credentials and confirm signed upload, translation status, visualization, selecting a component, reading model properties and exporting CSV using a sample DWG or RVT file.
- On Robot viewer, press **تحميل نموذج تجريبي**; check node/bar counts and rotation sliders; test CSV import and export.
- Test on Android with a small file and network constraints before attempting large files.

## Roadmap

1. Production authentication (users, project tenancy, isolated storage, quotas, retention and cost controls).
2. Revit BIM quantity extraction: category-specific takeoffs with unit normalization.
3. Civil 3D alignments, profiles and surfaces: extraction through Civil 3D-specific APIs/export workflows rather than assuming all custom entities are available in a generic DWG derivative.
4. Robot native integration through supported exports/API or desktop bridge (with explicit user authorization and proprietary SDK/license prerequisites); result tables for force, displacement and utilization visualizations.
5. Secure AI file/report interpretation with citation to model element IDs and calculation assumptions; no automatic engineering approval.

Official references: https://aps.autodesk.com/developer/overview/model-derivative-api and https://help.autodesk.com/cloudhelp/ENU/ADSKVIEWER-Help/files/ADSKVIEWER_Help_SupportedFileTypes_html.html
