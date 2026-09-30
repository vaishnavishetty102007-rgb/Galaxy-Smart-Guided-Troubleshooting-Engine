# Galaxy Smart Guided Troubleshooting Engine

> Turns vague, natural-language Galaxy device complaints into validated, ordered, **one-tap troubleshooting plans** with verified Samsung One UI Settings deeplinks.

A full-stack TypeScript application (Express + React + Vite) built for the **Samsung PRISM Gen AI Hackathon, Theme 02: Smart Guided Troubleshooting Engine**. A customer types (or speaks) something like *"my screen flickers and battery dies fast"*, in any language, and gets back a structured plan: a goal, ordered actions, discrete steps, and masked `bixby://` deeplinks that open the exact Settings screen each step needs.

The engine is designed so that **AI proposes and code disposes**: an LLM (Gemini) may draft a plan, but deterministic code retrieves the deeplinks, strips any web URLs, enforces the output schema, and orders actions by risk. If no API key is configured, the whole pipeline still works offline.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Architecture](#architecture)
3. [Pipeline in Detail](#pipeline-in-detail)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Getting Started](#getting-started)
7. [Configuration](#configuration)
8. [Using the App](#using-the-app)
9. [REST API Reference](#rest-api-reference)
10. [Data Contract (Schema)](#data-contract-schema)
11. [Data Files](#data-files)
12. [Evaluation and Benchmarks](#evaluation-and-benchmarks)
13. [Safety and Guardrails](#safety-and-guardrails)
14. [Scripts](#scripts)
15. [Deployment](#deployment)
16. [Known Limitations](#known-limitations)
17. [Roadmap](#roadmap)
18. [License](#license)

---

## Key Features

| Area | What it does |
|---|---|
| **Multilingual understanding** | Detects and normalizes English, Hindi, Kannada, Tamil, Hinglish (and any language Gemini supports) into a canonical English complaint. |
| **Domain triage** | Classifies each complaint into one of 10 domains: Battery, Display, Camera, Performance, Network, Audio, Storage, Apps, Safety, System. |
| **Clarifying questions** | For vague inputs like "phone slow", asks a targeted multiple-choice question before building a plan. |
| **Screenshot diagnosis** | Accepts a base64 screenshot (up to 10 MB) and passes it to Gemini vision. |
| **Fast-path semantic cache** | Serves validated plans for known/paraphrased complaints without an LLM round-trip (target: under 300 ms). |
| **Hybrid deeplink retrieval** | BM25 retrieval plus domain boosting maps each action to one of 36 verified, masked Galaxy Settings deeplinks. |
| **Strict validation** | Zero URL leaks, exact goal/title/description syntax, action ordering (auto, then manual, then critical), catalog-only URIs. |
| **Risk-aware actions** | Every action carries `category` (auto / manual / critical), `riskLevel` and `requiresConfirmation`. |
| **Human escalation** | Low-confidence plans (below 0.65) return an escalation note for a Tier-2 support handoff. |
| **Prompt-injection guard** | Offline regex guard blocks jailbreak and "show me all links" style inputs. |
| **Feedback loop** | "Did this fix it?" votes feed cache quality and analytics. |
| **Two UIs** | A friendly customer view and a hidden developer console with 6 diagnostic tabs. |
| **Graceful degradation** | No API key or quota exhausted? The engine falls back to rule-based understanding and grounded One UI knowledge. |

---

## Architecture

```
                 ┌──────────────────────────────────────────────┐
                 │                React Frontend                │
                 │  Customer View (/)   Developer Console       │
                 │                      (?console=1)            │
                 └───────────────────────┬──────────────────────┘
                                         │  fetch
                                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Express Server (server.ts)                           │
│  rate limiter (60 req/min/IP) · JSON body limit 10 MB · analytics      │
│  /v1/troubleshoot  /health  /api/*                                     │
└───────────────────────────────┬────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Engine Pipeline (src/engine)                       │
│                                                                        │
│  1. Injection guard ──► 2. Understanding ──► 3. Clarify? ──► 4. Cache  │
│      (regex)              (Gemini/offline)     (vague input)   (fast)  │
│                                                                  │miss │
│                                                                  ▼     │
│  7. Cache store ◄── 6. Validator ◄── 5b. Deeplink matcher ◄── 5a. Plan │
│   (conf ≥ 0.85)     (schema/URLs)       (BM25 + catalog)      extract  │
└────────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴────────────────┐
                ▼                                ▼
      src/data/deeplinks.json          Gemini API (optional)
      (36 masked bixby:// URIs)        @google/genai
```

In development, Vite runs in **middleware mode** inside the same Express process, so one command starts both the API and the UI. In production the server serves the pre-built `dist/` folder.

---

## Pipeline in Detail

The core lives in `src/engine/pipeline.ts` (`runTroubleshootPipeline`).

1. **Prompt-injection guard** (`understand.ts`). A set of regex patterns (e.g. "ignore your rules", "system prompt", "jailbreak", "bypass") short-circuits the request with a safe refusal plan pointing to the Auto Blocker security screen.
2. **Fast-path cache check.** For text-only requests without clarification answers, the semantic cache is checked first, before any LLM or understanding work.
3. **Query understanding** (`understand.ts`). Gemini detects the language, translates to a canonical English complaint, classifies the domain, flags vagueness, and estimates confidence. If there is no API key or the free-tier quota is hit, `offlineUnderstand()` handles it with script detection (Devanagari, Kannada, Tamil), Hinglish keyword matching and domain keyword rules. A quota error pauses Gemini calls for 60 seconds.
4. **Clarifying questions.** If the input is vague and no answers were supplied, the response contains `clarificationNeeded: true` and a `clarifyingQuestions` array. Answers are sent back in `clarification_answers` and merged into the query.
5. **Semantic cache lookup** (`cache.ts`). Queries are normalized (stop words removed, synonyms collapsed into concepts such as `lag`, `drain`, `flicker`) and compared by similarity. A hit needs similarity of at least **0.70** *and* domain alignment, which prevents cross-domain contamination.
6. **Plan extraction** (cold path). `extractWithGemini()` asks Gemini (temperature 0, JSON output) to produce a plan following strict rules: goal syntax, 2 to 3 word title, one action per screen, 5 to 7 word `It will…` descriptions, and no URLs. Grounding text comes from the caller's `siis_response`, or from the bundled SIIS data / built-in per-domain One UI knowledge. Without Gemini, `extractFromKnowledge()` builds the plan directly from that grounded text and sorts steps into auto, manual and critical buckets.
7. **Deeplink mapping** (`matcher.ts`). Each non-manual step group is matched against the catalog with BM25 scoring plus domain boosts, returning an `actionableDeeplink` and, where available, a `validationDeeplink`. Manual actions never receive deeplinks.
8. **Validation** (`validator.ts`). Scrubs URLs and markdown links, enforces goal, title and description syntax, orders actions **auto → manual → critical**, and checks every URI against the catalog allow-list.
9. **Confidence, escalation and caching.** Confidence is `0.5 × understanding confidence + 0.5 × average match quality`. Below 0.65 an escalation note is attached. Only plans with confidence of at least 0.85 and no escalation are written to the cache, which prevents cache poisoning.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (ES modules) |
| Backend | Node.js, Express 4 |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Lucide icons, Motion |
| AI (optional) | Google Gemini via `@google/genai` |
| Retrieval | In-house BM25 index over the deeplink catalog |
| Dev runner | `tsx` (runs `server.ts` directly) |

Full dependency list: see `package.json` and `requirements.txt`.

---

## Project Structure

```
.
├── server.ts                 # Express server, REST API, rate limiter, analytics store
├── index.html                # Vite entry HTML
├── vite.config.ts            # Vite + React + Tailwind config
├── tsconfig.json
├── package.json
├── metadata.json             # AI Studio applet metadata
├── .env.example              # Environment variable template
└── src/
    ├── main.tsx              # React entry point
    ├── App.tsx               # Routes between Customer View and Developer Console
    ├── index.css
    ├── types/
    │   └── schema.ts         # Data contract (TypeScript port of the official schema)
    ├── engine/
    │   ├── pipeline.ts       # Orchestrates the full troubleshooting pipeline
    │   ├── understand.ts     # Language detection, triage, injection guard (Gemini + offline)
    │   ├── cache.ts          # Fast-path semantic cache
    │   ├── matcher.ts        # BM25 deeplink retrieval
    │   ├── validator.ts      # Schema and rule enforcement, URL scrubbing
    │   └── evaluator.ts      # Benchmark harness that generates metrics.md
    ├── data/
    │   ├── deeplinks.json    # 36 masked Galaxy Settings deeplinks
    │   ├── siis_responses.json  # 6 Samsung Issue Information System reference texts
    │   ├── queries.json      # 6 canonical test queries with paraphrases
    │   └── samples.json      # 5 pre-built sample plans used to warm the cache
    ├── views/
    │   ├── CustomerView.tsx  # Consumer-facing mobile-first UI
    │   └── ConsoleView.tsx   # Developer console shell (6 tabs)
    └── components/
        ├── WorkbenchTab.tsx        # Execution trace, timings, raw JSON
        ├── ParaphraseLabTab.tsx    # Paraphrase and cache benchmarking
        ├── CatalogTab.tsx          # Deeplink catalog explorer
        ├── AnalyticsTab.tsx        # Support-team dashboard
        ├── EvaluationTab.tsx       # metrics.md gates and baseline comparison
        ├── ApiDocsTab.tsx          # API docs and cURL sandbox
        ├── DeviceSimulator.tsx     # Galaxy phone simulator
        └── Header.tsx
```

---

## Getting Started

### Prerequisites

- **Node.js 20 or newer** (22 LTS recommended) and **npm**
- *(Optional)* a **Gemini API key** from [Google AI Studio](https://aistudio.google.com/) for LLM-powered understanding and extraction

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/vaishnavishetty102007-rgb/Galaxy-Smart-Guided-Troubleshooting-Engine.git
cd Galaxy-Smart-Guided-Troubleshooting-Engine

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# then edit .env and set GEMINI_API_KEY (or leave it unset to run offline)

# 4. Start the dev server (API + UI together)
npm run dev
```

Open **http://localhost:3000**.

> **No Gemini key?** The app still works. Understanding falls back to the rule-based offline path and plans are generated from the bundled SIIS and One UI knowledge.

---

## Configuration

Set these in `.env` (loaded by `dotenv`):

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | No | none | Enables Gemini-powered understanding, vision and plan extraction. Unset means offline mode. |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Overrides the Gemini model used. |
| `PORT` | No | `3000` | HTTP port. |
| `NODE_ENV` | No | unset | Set to `production` to serve the built `dist/` bundle instead of Vite middleware. |
| `APP_URL` | No | none | Hosted URL (injected automatically on Google AI Studio / Cloud Run). |

> Never commit your real `.env`. It is already covered by `.gitignore` (only `.env.example` is tracked).

---

## Using the App

### Customer View (default, `/`)

A clean, mobile-first support experience with no technical jargon:

- Type a complaint in your own words, in any language
- Use the **microphone** for voice input (browser Web Speech API, `en-IN`)
- Attach a **screenshot** for diagnosis
- Follow a **numbered step checklist** for each action
- Tap **Open in Settings** for one-tap deeplinks
- Tap **Send to my phone** to show a QR code that carries the deeplink
- See **safety warnings** and confirmation prompts for risky actions
- Answer **clarifying questions** when the complaint is vague
- Rate the result with **"Did this fix it?"**
- See the **escalation** card when the engine is not confident

### Developer Console (`/?console=1`)

Open it with the URL parameter `?console=1`, the keyboard shortcut **Ctrl + Shift + D**, or the footer link. It has six tabs:

| Tab | Purpose |
|---|---|
| **Troubleshoot Workbench** | Full execution trace, per-stage timings, raw JSON, validation results and a Galaxy phone simulator. |
| **Paraphrase & Cache Lab** | Benchmarks cache hit rate and latency across 10 linguistic registers. |
| **Deeplink Catalog** | Interactive explorer of the 36 masked deeplinks across the domains, with BM25 retrieval. |
| **Analytics** | Cache hit rate, average latency, domain breakdown, feedback and estimated cost savings. |
| **Evaluation** | Automated gate checks and a baseline comparison table (`metrics.md`). |
| **API & cURL Sandbox** | Interactive API documentation and a request tester. |

---

## REST API Reference

Base URL: `http://localhost:3000`

### `GET /health`

```json
{
  "status": "ok",
  "initialized": true,
  "cache_entries": 5,
  "catalog_size": 36,
  "timestamp": "2026-09-30T10:00:00.000Z"
}
```

### `POST /v1/troubleshoot`

Main endpoint. Rate limited to **60 requests per minute per IP**. `query` is required and capped at **500 characters**.

**Request**

```json
{
  "query": "My screen flickers and the battery dies fast",
  "siis_response": "optional raw SIIS troubleshooting text used as grounding",
  "image_base64": "optional data:image/png;base64,...",
  "language": "auto",
  "device_context": {
    "model": "Samsung Galaxy S24 Ultra",
    "oneUiVersion": "One UI 6.1",
    "androidVersion": "Android 14"
  },
  "clarification_answers": { "q_batt_type": "Drains quickly even when screen is off in standby" }
}
```

| Field | Type | Notes |
|---|---|---|
| `query` | string | **Required.** Max 500 chars. |
| `siis_response` | string | Optional grounding text. Overrides bundled knowledge. |
| `image_base64` | string | Optional screenshot (data URI or raw base64). Bypasses the cache. |
| `language` | `auto` \| `en` \| `hi` \| `kn` \| `ta` \| `hinglish` | Optional hint. |
| `device_context` | object | Optional. Defaults to Galaxy S24 Ultra, One UI 6.1, Android 14. |
| `clarification_answers` | object | Answers to a prior `clarifyingQuestions` response. |

**Response (abridged)**

```json
{
  "query": "My screen flickers and the battery dies fast",
  "query_variations": ["..."],
  "response": {
    "contexts": [
      {
        "goal": "Follow these steps to perform this Display flicker settings Troubleshooting",
        "title": "Display flicker settings",
        "score": 0.92,
        "actions": [
          {
            "actionName": "Motion Smoothness",
            "description": "It will adjust display refresh behavior",
            "category": "auto",
            "riskLevel": "safe",
            "requiresConfirmation": false,
            "stepGroups": [
              {
                "steps": ["Navigate to Settings.", "Tap Display.", "Tap Motion smoothness."],
                "actionableDeeplink": {
                  "deeplink": "bixby://masked/...",
                  "description": "...",
                  "message": "..."
                },
                "validationDeeplink": null
              }
            ]
          }
        ]
      }
    ],
    "qrPayloadUrl": "intent://bixby://...#Intent;scheme=bixby;package=com.samsung.android.bixby.agent;end"
  },
  "meta": {
    "latency_ms": 18,
    "cache_hit": true,
    "similarity_score": 0.98,
    "model": "gemini-3.8-flash",
    "cost_usd": 0,
    "detected_language": "English",
    "device_context": { "model": "Samsung Galaxy S24 Ultra", "oneUiVersion": "One UI 6.1", "androidVersion": "Android 14" },
    "trace_id": "trace_cache_1730000000000"
  },
  "trace": { "detectedDomain": "Display", "cacheHit": true, "stageTimings": { "totalMs": 18 } }
}
```

**Special responses**

- **Vague input:** `contexts: []`, `clarificationNeeded: true`, plus `clarifyingQuestions`.
- **Prompt injection:** a refusal plan with `meta.prompt_injection_blocked: true`.
- **Low confidence:** an `escalation` object with a recommended department and summary.
- **Errors:** `400` (missing or over-long query), `429` (rate limited), `500` (returns `contexts: []` and `fallback: "no_match"`).

**Example cURL**

```bash
curl -X POST http://localhost:3000/v1/troubleshoot \
  -H "Content-Type: application/json" \
  -d '{"query":"phone battery drains very fast even on standby"}'
```

### Other endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/catalog` | Full indexed deeplink catalog (`total`, `items`). |
| `GET` | `/api/cache/stats` | Cache hit/miss counts, P95 latency and all entries. |
| `POST` | `/api/cache/clear` | Resets and pre-warms the semantic cache. |
| `GET` | `/api/benchmark` | JSON benchmark summary and ablation (cached after first run). |
| `POST` | `/api/benchmark/run` | Re-runs the full evaluation suite. |
| `GET` | `/api/metrics` | Benchmark report as Markdown (`metrics.md`). |
| `POST` | `/api/feedback` , `/v1/feedback` | Body: `{ "cacheKey": "...", "helpful": true }`. |
| `GET` | `/api/analytics` , `/v1/analytics` | Live operational telemetry. |

---

## Data Contract (Schema)

Defined in `src/types/schema.ts` (a TypeScript port of the official Theme 02 schema).

```
ContextDeeplinkResponse
└── contexts: Goal[]
    └── Goal { goal, title, score, actions[] }
        └── Action { actionName, description, category, riskLevel, requiresConfirmation, stepGroups[] }
            └── StepGroup { steps[], actionableDeeplink?, validationDeeplink? }
```

**Enforced output rules**

| Field | Rule |
|---|---|
| `goal` | Exactly `Follow these steps to perform this <Topic> Troubleshooting` (or `Configuration`). |
| `title` | 2 to 3 words, sentence case. |
| `description` | 5 to 7 words, starting with `It will`. |
| `category` | `auto` (settings screens), `manual` (physical actions), `critical` (restart, safe mode, reset). |
| Ordering | auto, then manual, then critical. |
| Deeplinks | Only URIs from the catalog. Manual actions have none. |
| URLs | Zero `http`, `https`, `www` or markdown links anywhere in the output. |

---

## Data Files

| File | Contents |
|---|---|
| `deeplinks.json` | 36 masked `bixby://` deeplinks across Display, System, Performance, Battery, Camera, Audio, Network, Storage, Apps and Safety, with keywords, control type, category and optional toggle validation. |
| `siis_responses.json` | 6 reference troubleshooting texts (Samsung Issue Information System style). |
| `queries.json` | 6 canonical benchmark queries with expected titles, category order and paraphrase variations. |
| `samples.json` | 5 pre-built validated plans used to pre-warm the semantic cache. |

To extend the engine, add new entries to `deeplinks.json` (the validator's URI allow-list is built from it automatically) and new samples to `samples.json`.

---

## Evaluation and Benchmarks

`src/engine/evaluator.ts` runs the pipeline across the reference queries and produces a report available at `/api/metrics` (Markdown), `/api/benchmark` (JSON) or the **Evaluation** tab of the console. It measures:

- Schema validity and rule compliance
- Absolute URL leaks (target: 0)
- Catalog validity of every returned deeplink
- Share of auto actions carrying a deeplink
- Cache-hit latency (exact and paraphrase, P95) versus cold-query latency
- Semantic cache hit rate and cost per query
- A baseline comparison against a plain Gemini prompt and a small ablation table

> The cold-path test runs only once per benchmark to respect free-tier Gemini quotas.

---

## Safety and Guardrails

- **Prompt-injection blocking** with an instant, offline regex check.
- **No web URLs** in any output, scrubbed programmatically after generation.
- **Catalog allow-list** so an LLM can never invent a deeplink.
- **Risk labelling and confirmation** for restart, reset and other critical actions.
- **Escalation** to a human agent when confidence is low.
- **Cache-poisoning protection** since only high-confidence plans are cached.
- **Input limits**: 500-character queries, 10 MB request bodies, 60 requests per minute per IP.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Express server with Vite middleware (`tsx server.ts`). |
| `npm run build` | Builds the frontend into `dist/` (`vite build`). |
| `npm start` | Runs the server (`tsx server.ts`). Set `NODE_ENV=production` to serve `dist/`. |
| `npm run preview` | Previews the Vite build. |
| `npm run lint` | Type-checks the project (`tsc --noEmit`). |
| `npm run clean` | Removes `dist/` and `server.js`. |

---

## Deployment

```bash
npm install
npm run build
NODE_ENV=production PORT=3000 GEMINI_API_KEY=your_key npm start
```

The project is also set up for **Google AI Studio / Cloud Run**, where `GEMINI_API_KEY` and `APP_URL` are injected automatically (see `metadata.json`).

---

## Known Limitations

Being upfront about the current state of the prototype:

- **Analytics and cache are in-memory.** They reset on restart, and the analytics store starts with seeded demo numbers (24 requests, 19 cache hits).
- **Deeplinks are masked demo URIs** (`bixby://masked/...`) and have not been verified on physical Galaxy hardware.
- **Offline understanding is keyword-based**, so coverage of non-English phrasing without Gemini is limited to a small set of terms.
- **Injection detection is regex-based**, which is fast but not exhaustive.
- **The "Send to my phone" QR** is generated via the public `api.qrserver.com` service, which means the deeplink is sent to a third party. Replace it with a local QR library for production.
- **No automated test suite** is included beyond the built-in benchmark harness.
- The default Gemini model name (`gemini-3.8-flash`) and some dependency versions should be confirmed against what is currently available before deploying. Override the model with `GEMINI_MODEL` if needed.

---

## Roadmap

- Persist cache, analytics and feedback in a database (Redis / Postgres)
- Dense-embedding retrieval alongside BM25
- Verify deeplinks against real device profiles and One UI versions
- Add automated unit and integration tests
- Voice-assistant (Bixby) entry point and on-device inference
- Expand the deeplink catalog and SIIS knowledge base

---

## License

Source files carry an `Apache-2.0` SPDX header. Add a `LICENSE` file to the repository root to make this explicit.
