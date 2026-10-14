# 💻 ApexLead AI — Frontend Studio

This is the web client application for **ApexLead AI**, built with **React 19**, **Vite**, and **React Router 7**, styled with a custom glassmorphism design system in Vanilla CSS.

---

## 🚀 Key Modules & Pages

The frontend application provides six core workspaces:

| Route | Page Component | Description |
|---|---|---|
| `/` | `Landing.jsx` | Executive dashboard & high-level overview of lead intelligence modules. |
| `/overseas-pakistanis` | `OverseasLeadsPage.jsx` | Core live diaspora discovery engine. Filters by country, profession, and wealth tier, displays scores, provides evidence breakdowns, triggers OSINT contact enrichment, and launches WhatsApp outreach. |
| `/leads` | `LeadDatabasePage.jsx` | CRM sales pipeline & lead repository. Tracks conversion stages (`New` ➔ `Converted`), provides detailed lead cards, supports CSV prospect imports, and exports data to Excel (`.xlsx`), CSV, and JSON. |
| `/maps` | `MapsPage.jsx` | Google Maps business scraper interface for extracting local diaspora business contacts, websites, and reviews. |
| `/dorking` | `DorkingPage.jsx` | Visual Google/Bing search operator studio with presets for executive discovery and conference bios. |
| `/compliance` | `CompliancePage.jsx` | Do Not Contact (DNC) suppression registry management and system audit log viewer. |
| `/settings` | `SettingsPage.jsx` | Global preferences, scraper timeouts, and search defaults. |

---

## 🎨 UI Architecture & Design System

- **Framework**: React 19 (Functional components & hooks)
- **Routing**: React Router v7 (`BrowserRouter`, `Routes`, `Route`, `useNavigate`)
- **Styling**: Vanilla CSS (`src/App.css` & `src/index.css`) featuring:
  - Deep obsidian dark mode (`#0b0f19`) with indigo/emerald accent glows.
  - Frosted glassmorphism panels with subtle borders (`backdrop-filter: blur(12px)`).
  - Fully responsive grid and flexbox layouts optimized for mobile and desktop screens.
  - Micro-animations for modal dialogs, drawers, and card hover states.
- **Icons**: Modular inline SVG library in `src/components/Icons.jsx`.

---

## 🛠️ Directory Structure

```
frontend/
├── public/                 # Static assets and favicon
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Navbar.jsx      # Top navigation header with active page indicators
│   │   ├── Icons.jsx       # Inline SVG icon definitions
│   │   ├── ExportButtons.jsx # One-click export triggers (Excel, CSV, JSON)
│   │   ├── SearchFilters.jsx # Country & profession selector pills
│   │   ├── ResultsTable.jsx  # Scraped data table component
│   │   ├── StatsCards.jsx  # Metrics & KPI summary cards
│   │   └── Toast.jsx       # Alert feedback notifications
│   ├── pages/              # Primary view pages (see table above)
│   ├── api.js              # Centralized API base URL resolver (`/api`)
│   ├── App.jsx             # Route definitions & 404 handler
│   ├── main.jsx            # Application root renderer
│   ├── App.css             # Main stylesheet & glassmorphic classes
│   └── index.css           # Global CSS variables & font resets
├── index.html              # HTML shell
├── vite.config.js          # Vite config with dev proxy to backend port 8005
├── nginx.conf              # Production Nginx reverse proxy configuration
├── Dockerfile              # Multi-stage production Docker build
└── package.json            # Node dependencies and scripts
```

---

## ⚙️ Development & Scripts

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
To enable LAN access from mobile devices on the same Wi-Fi network:
```bash
npm run dev -- --host 0.0.0.0
```
- Local URL: `http://localhost:5173`
- Network URL: Displayed in the terminal output (e.g. `http://192.168.x.x:5173`)

### 3. Build for Production
```bash
npm run build
```
Build output is generated into the `dist/` directory.

### 4. Preview Production Build
```bash
npm run preview
```

### 5. Lint Code
```bash
npm run lint
```

---

## 🔄 Backend API Proxy Configuration

In development, Vite proxies requests from `/api` to the backend service running on `http://127.0.0.1:8005`:

```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/health': {
        target: 'http://127.0.0.1:8005',
        changeOrigin: true,
      },
    },
  },
})
```

In Docker / production, `nginx.conf` proxies `/api/` traffic directly to the backend container on port 8005.
