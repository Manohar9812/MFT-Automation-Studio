# MFT Automation Studio

A self-contained, browser-based tool for generating **IBM Sterling B2B Integrator** artefacts
(BPML business processes, SI import XML, and XSLT configuration blocks) from a short guided form.

Built by the Integration Services team at **Southern California Edison (SCE)**.

![Stack](https://img.shields.io/badge/stack-vanilla%20JS-blue)
![No build](https://img.shields.io/badge/build-none-brightgreen)

---

## ✨ Features

- **Guided wizard** – pick an interface (Mailbox→FS, SFTP→FS, etc.) and fill a short form.
- **Multiple XSLT blocks per interface** – e.g. SFTP Get config, Error e-mail, Success e-mail.
- **SFTP config page** renders fields in exact XSLT order with simple Yes/No toggles.
- **Import existing artefacts** and analyse them back into the form (round-trip).
- **Download** individual files, copy to clipboard, or export a `.zip` package (via JSZip).
- **Access accounts** – admin-managed sign-in accounts (add / disable / reset / delete users).
- **Built-in self-test** – 62 automated checks validating generated output.
- **Zero build step** – plain HTML/CSS/vanilla JS. No npm, no bundler.

---

## 🚀 Running locally

Because the app loads JavaScript files with `<script src>`, it should be served over HTTP
(opening `index.html` directly via `file://` works in most browsers, but a local server is safest).

### Option 1 – Python (built-in)

```powershell
# from inside this folder
python -m http.server 8080
```
Then open <http://localhost:8080/index.html>.

### Option 2 – Node (http-server)

```powershell
npx http-server -p 8080
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
├── index.html            # App shell (login + sidebar layout)
├── css/
│   └── app.css           # SCE white / yellow / black theme
├── js/
│   ├── templates.js      # Built-in templates + config maps (window.__BUILTIN__)
│   ├── golden.js         # Fixed reference state for the self-test
│   └── app.js            # All application logic (wizard, engine, auth, views)
├── assets/
│   └── sce-logo.svg      # SCE sunburst logo
├── templates/            # Plain-text copies of the templates (reference)
│   ├── mb-fs/
│   └── sftp-fs/
└── samples/              # Sample input/output artefacts
```

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
