# MFT Automation Studio

A self-contained, browser-based tool for generating **IBM Sterling B2B Integrator** artefacts
(BPML business processes, SI import XML, and XSLT configuration blocks) from a short guided form.

Built by the Integration Services team at **Southern California Edison (SCE)**.

![Stack](https://img.shields.io/badge/stack-vanilla%20JS-blue)
![No build](https://img.shields.io/badge/build-none-brightgreen)

---

## ✨ Features

- **Guided wizard** – pick an interface (Mailbox→FS, SFTP→FS, EDI 810/814/…​, etc.) and fill a short form.
- **AI Assistant** – a LangGraph/LangChain copilot (Azure OpenAI) that recommends the right
  approved template and collects every field section-by-section, including EDI envelopes.
- **EDI trading-partner envelopes** – ISA/GS/ST segments are read from each interface's
  `Envelopes.xml`, made editable (name, sender/receiver IDs, control numbers, parms), and
  regenerated as importable XML.
- **Multiple XSLT blocks per interface** – e.g. SFTP Get config, Error e-mail, Success e-mail.
- **SFTP config page** renders fields in exact XSLT order with simple Yes/No toggles.
- **Import existing artefacts** and analyse them back into the form (round-trip).
- **Download** individual files, copy to clipboard, or export a `.zip` package (via JSZip).
- **Access accounts** – admin-managed sign-in accounts (add / disable / reset / delete users).
- **Built-in self-test** – automated checks validating generated output.
- **Zero build step** for the frontend – plain HTML/CSS/vanilla JS. No npm, no bundler.

---

## 🚀 Running locally

Because the app loads JavaScript files with `<script src>`, it should be served over HTTP
(opening `index.html` directly via `file://` works in most browsers, but a local server is safest).

### Option 1 – Python (built-in)

```powershell
# from inside the frontend folder
cd frontend
python -m http.server 8080
```
Then open <http://localhost:8080/index.html>.

### Option 2 – One-click launcher (backend + frontend)

```powershell
# from the repo root — starts the AI backend and serves the frontend
.\serve.ps1
```

### Option 3 – VS Code

Install the **Live Server** extension and click **Go Live**.

---

## 🔑 First sign-in

A default administrator account is seeded automatically on first launch:

| User ID | Password |
| ------- | -------- |
| `admin` | `admin`  |

After signing in, open **Administration → Access accounts** to add your own users and
change roles. Accounts are stored locally in the browser (`localStorage`).

> ⚠️ **Note:** This is an internal, local-only tool. Passwords are stored with a lightweight
> hash in `localStorage`, which is **not** a security boundary. Do not reuse real credentials.

---

## 🧪 Self-test

Open the app and choose **Run self-test** in the sidebar, or append `?selftest` to the URL:

```
http://localhost:8080/index.html?selftest
```

All 62 checks should report **PASS**.

---

## 📁 Project structure

```
.
├── serve.ps1               # Local launcher (starts backend + serves frontend/)
├── README.md  LICENSE  .gitignore
├── frontend/               # Static web app (no build step)
│   ├── index.html          # App shell (login + sidebar layout)
│   ├── css/app.css         # SCE white / yellow / black theme
│   ├── js/
│   │   ├── templates.js     # Built-in templates + config maps (window.__BUILTIN__)
│   │   ├── edi-envelopes.js # EDI trading-partner envelope parser/generator
│   │   ├── golden.js        # Fixed reference state for the self-test
│   │   ├── app.js           # Application logic (wizard, engine, auth, views)
│   │   └── ai.js            # AI Assistant chat UI (talks to the backend)
│   ├── assets/sce-logo.svg
│   ├── templates/           # Reference artefacts, grouped by type
│   │   ├── edi/             # EDI interfaces (810_OB, 814_IB, …, 867)
│   │   │   └── <interface>/ # Envelopes.xml + route rules + XSLT config blocks
│   │   └── generic/         # Generic transfers (MB_MB, FS_FS, SFTP_TO_FS, …)
│   └── samples/             # Sample input/output artefacts
└── backend/                # FastAPI + LangGraph/LangChain AI service
    ├── app.py              # REST API (/api/chat, /api/agent, /api/extract …)
    ├── agent.py            # LangGraph agents + Azure OpenAI (LangChain)
    ├── catalog.py/.json    # Approved-interface catalog + retrieval
    ├── knowledge.py        # Grounding facts for the assistant
    ├── config.py           # Loads secrets from backend/.env (git-ignored)
    ├── .env.example        # Template — copy to backend/.env and fill in secrets
    └── requirements.txt    # Python dependencies
```

Each EDI interface folder uses a consistent **`Envelopes.xml`** for the trading-partner
ISA/GS/ST segments, which the app fetches at runtime (see the `MAP` in `frontend/js/edi-envelopes.js`).

---

## 🌐 Deploying to GitHub Pages

This is a static site, so GitHub Pages works out of the box:

1. Push this folder to a GitHub repository (see below).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**,
   **Branch = `main`**, **Folder = `/ (root)`**, then **Save**.
4. Your site will be live at `https://<username>.github.io/<repo>/`.

---

## ⬆️ Pushing to GitHub

```powershell
git init
git add .
git commit -m "Initial commit: MFT Automation Studio"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

---

## 📝 License

Internal use. See [LICENSE](LICENSE).
