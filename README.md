# CoalGov AI

**AI-Powered Digital Governance & Compliance Monitoring Platform for Indian Coal Mines**

SIH 2026 prototype · Problem Statement ID **26024** · Theme **Smart Automation** · Category **Software** · Team **Elysium**

---

## What this actually is

CoalGov AI is not a complaint portal. It is a **closed-loop governance system**. Every field
observation is tracked through a single auditable lifecycle, and only a human officer can close a
safety case:

```
FIELD OBSERVATION → DIGITAL REPORT → AI ANALYSIS → SEVERITY / RISK
      → AUTO-ASSIGN RESPONSIBLE OFFICER → SLA DEADLINE
      → CORRECTIVE ACTION → MOBILE CAMERA + GPS EVIDENCE
      → AI-ASSISTED VERIFICATION → MINE OFFICER VERIFY / REJECT
      → REWORK IF REJECTED → VERIFIED CLOSURE → AUDIT TRAIL
```

If the SLA is breached, the case escalates automatically:

```
SLA BREACH → MINE MANAGER → CORPORATE / SUBSIDIARY → HIGHER AUTHORITY / REGULATOR
```

The hero screen is **Violation Detail** (`/violations/:id`): original evidence with GPS and
timestamp on the left, AI analysis in the centre, assignment and SLA countdown on the right, and
the full lifecycle timeline along the bottom.

---

## Stack

| Layer | Technology |
| --- | --- |
| Views | EJS, HTML5, CSS3, vanilla JS, Bootstrap 5, Chart.js, Leaflet |
| Server | Node.js, Express 4 |
| Database | MongoDB + Mongoose |
| Cache / sessions | Redis (optional, see `USE_REDIS_SESSION`) |
| AI | **Groq only** (`groq-sdk`) |
| Auth | Session-based, bcrypt password hashing, role-based access control |
| Uploads | Local disk via Multer (`public/uploads/`) |

No Python, XGBoost, TensorFlow or PyTorch is used anywhere in the current implementation. See
[Future production extensions](#future-production-extensions) for what a production build would add.

---

## Roles

Six roles, each with its own dashboard and enforced route permissions:

| Role | Login redirect | Scope |
| --- | --- | --- |
| `admin` | Admin dashboard | Personnel, mines, SLA config, AI/system settings, audit |
| `mine_officer` | Mine officer dashboard | Report violations, verify evidence, close cases |
| `responsible_officer` | Task dashboard | Own assigned corrective actions and evidence |
| `mine_manager` | Mine manager dashboard | Mine-wide SLA breaches and escalations |
| `corporate_officer` | Corporate dashboard | Cross-mine compliance and SLA performance |
| `regulator` | Regulator dashboard | Escalation ledger, inspection and audit visibility |

There is **no public instant-access registration**. Officer onboarding is:
`admin creates/approves officer → account becomes active → officer can log in`.
Accounts move through `pending → approved | rejected | suspended`, and an account suspended
mid-session loses access on its next request.

### Dashboards

Every role gets a different dashboard, built from the live registers rather than mock counters:

| Role | Metrics | Deep panels |
| --- | --- | --- |
| `admin` | Compliance score, inspections, open violations, pending actions, high risk | Compliance by category, 6-month risk trend, ranked risk hotspots, inspection register, derived insights, document compliance, quick actions |
| `mine_officer` | Mine compliance, inspections, open violations, pending verification, high risk | Observation worklist with SLA countdown, severity split, mine profile, inspection schedule |
| `responsible_officer` | Assigned cases, due today, overdue, in progress, completed | Assigned worklist with start/submit actions, corrective-action summary, recent closures |
| `mine_manager` | Compliance, open/overdue issues, open-within-SLA, escalations | Risk overview, SLA performance, escalations, officer workload, inspection adherence |
| `corporate_officer` | Mines, violations, compliance rate, critical risks, SLA compliance, resolved | Trend + mine comparison charts, risk distribution, GIS map of all mines, mine-wise compliance table |
| `regulator` | Overall compliance, monitored mines, open/overdue cases, escalations | Mine-wise compliance, escalated cases, risk distribution, inspection history, audit trail (read-only) |

The dashboard header carries the reporting-period filter (the date range is a working filter, not a
label), export shortcut, notification centre, and the profile menu.

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in MONGODB_URI and (optionally) GROQ_API_KEY
npm run seed              # create the demonstration dataset
npm run dev               # http://localhost:3000
```

**Zero-config fallback.** If `MONGODB_URI` is unreachable the app automatically starts an embedded
in-memory MongoDB, seeds it, and runs anyway. This is ideal for a laptop demo, but the data is
discarded when the process stops.

### Demo accounts

Seeded and development-only. They are listed on the login page while `NODE_ENV !== 'production'`.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@coalgov.in` | `admin123` |
| Mine Officer | `officer@coalgov.in` | `officer123` |
| Responsible / Safety Officer | `safety@coalgov.in` | `safety123` |
| Mine Manager | `manager@coalgov.in` | `manager123` |
| Corporate Officer | `corporate@coalgov.in` | `corporate123` |
| Regulator | `regulator@coalgov.in` | `regulator123` |

`pending@coalgov.in` is deliberately left in `pending` state to demonstrate admin approval.

### Demo role switcher (development only)

Clicking the avatar in the header opens the profile menu, which hosts a **Demo Role Switcher**.
Selecting a role re-points the current session at that role's seeded account and reloads the
role-specific dashboard, so a reviewer can walk all six dashboards without signing in again:

```
/demo/admin  /demo/mine-officer  /demo/responsible-officer
/demo/mine-manager  /demo/corporate  /demo/regulator
```

The switcher is a testing convenience and is **hard-gated by `DEMO_MODE`**:

- `DEMO_MODE=true` — the switcher renders and the routes work. Every switch is written to the audit
  trail (`demo_role_switch`).
- `DEMO_MODE=false` — the switcher is not rendered and the routes return **403**. Production must go
  through the normal `login → authenticate → role verified → dashboard` flow.

Do not enable `DEMO_MODE` on a public deployment: it deliberately bypasses credential checks.

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | **Must include a database name** (e.g. `.../coalgov`) |
| `REDIS_URL` | Redis connection string (optional) |
| `USE_REDIS_SESSION` | `true` to keep sessions in Redis across instances |
| `SESSION_SECRET` | Session signing secret — use a long random value |
| `GROQ_API_KEY` | Server-side Groq key. Never exposed to browser JavaScript |
| `GROQ_MODEL` | Optional model override (default `openai/gpt-oss-120b`) |
| `APP_NAME` | Displayed application name |
| `DEMO_MODE` | `true` enables the demo role switcher and DEMO DATA badge. Leave `false` in production |
| `DISABLE_RATE_LIMIT` | Development only: bypass rate limiting for automated checks |

> **Database safety.** Always specify the database name in `MONGODB_URI`. A connection string with
> no database name defaults to the shared `test` database, and seeding it would delete other
> applications' data that lives in the same cluster. `npm run reset-demo` only ever drops
> CoalGov AI's own collections and reports anything it leaves untouched.

---

## The AI engine

`services/ai.service.js` implements four capabilities, all Groq-backed:

1. **Violation classification** — category, severity, risk level, reasoning, responsible department, suggested SLA.
2. **Risk assessment** — weighted factors: severity, recurrence, operational area, safety relevance, evidence strength, deadline sensitivity.
3. **Corrective action recommendation** — action, priority, department, expected completion, safety precautions.
4. **Evidence verification assistance** — evidence quality, possible mismatch, completion indicators, missing evidence, confidence.

Three properties matter for an honest demo:

- **Live when configured.** With `GROQ_API_KEY` set, the platform makes real Groq calls.
- **Labelled when not.** With no key (or an upstream failure) it returns clearly-marked `DEMO MODE`
  data. Every stored record carries `isDemo` and the interface renders a **DEMO MODE** badge, so
  sample output is never presented as live model output. Demo confidence is intentionally blank
  (`N/A`) rather than invented.
- **Model resilience.** Groq retires models periodically. If the configured model is unavailable
  for the key, the service walks `openai/gpt-oss-120b → openai/gpt-oss-20b → groq/compound-mini`
  instead of silently degrading to demo output. Live status and the active model are visible at
  `/admin/system-settings`.

Model output is also **normalised** before storage: free-text answers like `"High"` or
`"Immediate (within 4 hours)"` are coerced onto the database enums and numeric fields, so an
unpredictable model response can never corrupt a record or break the workflow.

**AI never closes a case.** It is human-in-the-loop by design — every AI surface states
*"AI-assisted recommendation — final verification remains with authorized officer"*, and closure
requires an explicit officer decision.

---

## Routes

```
/                      Public landing page
/auth/*                Login, logout, forgot password, reset password
/dashboard             Role-specific dashboard
/violations            List, /report (multi-step), /:id detail, /:id/verify
/inspections           List, /create, /:id
/corrective-actions    List, /:id
/compliance            Dashboard, /create, /:id
/contractors           List, /create, /:id
/reports               Hub + violations | compliance | inspections | sla + CSV export
/notifications         Alerts, mark read
/audit                 Immutable audit trail (admin, regulator)
/search                Global search across violations, mines, personnel, contractors, inspections
/admin/*               Users, registration requests, mines, SLA config, AI & system settings
/api/*                 JSON endpoints: stats, mines, map data, SLAs, notifications
/profile               Signed-in user's own profile, activity and preferences
/demo/scenario         Interactive 12-step closed-loop simulation
/demo/<role>           Demo role switcher (DEMO_MODE only; 403 when disabled)
/map                   GIS compliance map (Leaflet)
/health                Health probe (db + redis + demo mode)
```

---

## Verification

The repository ships a self-contained route, role and link test:

```bash
npm run smoke            # crawl every route as every role + verify every internal link
npm run smoke:workflow    # additionally exercise the full violation lifecycle
```

It boots the real Express app on an ephemeral port, enumerates every registered route from the
router stack, logs in as all six roles, checks for 5xx responses, render errors and dead internal
links, and (with `--workflow`) walks a violation from report to verified closure, asserting AI
analysis, risk level, auto-assignment, SLA creation, evidence submission, AI verification,
rejection/rework, closure and audit entries.

It also asserts both halves of the demo-switcher contract: each `/demo/<role>` route must land on
that role's own dashboard, and the same route must return **403** once `DEMO_MODE=false`.

Current status: **all routes × 6 roles, 0 dead links, 0 5xx, demo switcher PASS, lifecycle PASS.**

---

## Deployment

Any Node host works. Steps below use Render + MongoDB Atlas.

1. **Database.** Create an Atlas cluster, database user and network access rule. Copy the
   connection string and **append the database name**: `mongodb+srv://user:pass@cluster/coalgov`.
2. **Seed once, locally**, pointing at that database:
   ```bash
   MONGODB_URI="mongodb+srv://.../coalgov" npm run seed
   ```
   Seeding clears CoalGov AI's own collections first; it never touches other databases or
   collections in the same cluster.
3. **Service.** Create a Web Service from the repository.
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/health`
4. **Environment variables** (never commit these):
   `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET` (long random), `GROQ_API_KEY`,
   `APP_NAME=CoalGov AI`, `DEMO_MODE=false`. Set `PORT` only if the host requires it.
   Use `DEMO_MODE=true` **only** for an access-restricted evaluation or judging deployment: it
   enables the header role switcher, which bypasses credential checks by design. Any deployment
   that holds real data or is publicly reachable must run with `DEMO_MODE=false` (the switcher
   routes then return 403).
5. **Redis (optional).** Add a Redis instance, set `REDIS_URL` and `USE_REDIS_SESSION=true` when
   running more than one instance. Without it the app uses a single-instance in-memory store.
6. **Uploads.** `public/uploads/` is local disk and is ephemeral on most managed hosts. Persistent
   object storage is a production extension.
7. Verify the deployment: open `/health` (expect `"status":"ok"`, `"db":"connected"`) then log in.

Because `cookie.secure` is enabled when `NODE_ENV=production`, production deployment **requires
HTTPS**. Hosts such as Render provide this automatically.

---

## YouTube demo flow (recommended shot list)

1. **0:00 — Problem framing (landing page).** Scroll the landing page: the BEFORE (paper reports,
   manual follow-up, weak evidence) vs AFTER comparison and the closed-loop diagram.
2. **0:45 — Admin login.** Sign in as `admin@coalgov.in`. Show the KPI row, the compliance-by-category
   donut, the 6-month risk trend, the ranked risk hotspots and the derived insights panel. Open
   **Registration Requests** and approve the pending officer — demonstrating that there is no public
   self-registration.
2b. **1:30 — Demo role switcher.** Click the avatar in the header, show the role list, and switch to
   each dashboard in turn (Admin → Mine Officer → Responsible Officer → Mine Manager →
   Corporate → Regulator). Point out that the header, sidebar and dashboard all change, and that the
   switcher only exists because `DEMO_MODE=true`.
3. **1:45 — AI configuration.** `/admin/system-settings`: provider, active model, live vs DEMO MODE,
   SLA matrix and escalation chain. This is where you state that AI is real Groq inference and that
   DEMO MODE is always labelled.
4. **2:15 — Field report (the core demo).** Log in as `officer@coalgov.in`, use **+ Report
   Violation**: Step 1 details, Step 2 evidence (browser camera capture + GPS vs gallery upload —
   note the distinction), Step 3 submit. Watch the processing states:
   `REPORT SUBMITTED → AI ANALYZING → CLASSIFYING → ASSESSING RISK → ASSIGNING OFFICER → SLA CREATED`.
5. **3:30 — Violation Detail (hero screen).** Show the three columns: evidence + GPS, the AI
   analysis card with its DEMO MODE or live badge and the human-in-the-loop disclaimer, and the
   assignment with the live SLA countdown. Scroll to the lifecycle timeline.
6. **4:15 — Corrective action.** As `safety@coalgov.in`: **Start Action**, update progress, then
   submit resolution evidence captured by camera.
7. **5:00 — AI-assisted verification + rejection.** As `officer@coalgov.in` open **Verify**.
   Show AI's evidence assessment, then deliberately **reject** to demonstrate rework being
   required.
8. **5:45 — Verified closure.** Re-verify and approve. Show the case move to CLOSED, then open
   **Audit Logs** to show the immutable trail.
9. **6:30 — Escalation.** Open a seeded overdue case (`CG-2026-0002`) to show SLA breach and the
   Mine Manager → Corporate → Regulator escalation chain, then the regulator dashboard.
10. **7:15 — Scale view.** Global search, the GIS map, CSV report export, and `/demo/scenario` for
    the one-click 12-step simulation.

---

## Project structure

```
config/       db (with embedded fallback), redis, multer
controllers/  route handlers per domain
middleware/   auth, rbac, validation, rate limiting, error handling, uploads
models/       Mongoose schemas (User, Mine, Violation, Inspection, Contractor,
              ComplianceRequirement, CorrectiveAction, Assignment, RiskAssessment,
              Evidence, Notification, AuditLog)
routes/       Express routers
services/     ai, assignment, sla, escalation, notification, audit, report
utils/        constants, helpers, id generation, SLA configuration
scripts/      seed, seedData, resetDemo, smokeTest
views/        EJS templates + shared partials (sidebar, header, foot, badges, cards)
```

---

## Future production extensions

Not implemented in this prototype, listed for the production roadmap: Python/XGBoost predictive
risk models, computer-vision evidence matching, IoT/sensor telemetry ingestion (methane, dust,
ventilation), DGMS statutory system integration, offline-first mobile app with background sync,
object storage with signed URLs, and multi-tenant subsidiary isolation.

---

## Security notes

- Secrets live only in `.env`, which is git-ignored. `.env.example` contains placeholders only.
- The Groq key is used exclusively server-side and is never sent to the browser.
- Passwords are hashed with bcrypt (cost 12). Sessions are HTTP-only cookies.
- Rate limiting is applied to authentication and API routes; `DISABLE_RATE_LIMIT` is for local
  automated checks only.
