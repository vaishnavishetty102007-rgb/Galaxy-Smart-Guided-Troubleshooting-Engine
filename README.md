# Galaxy Smart Guided Troubleshooting Engine

Samsung Electronics Guided Self-Repair and Triage Engine for Galaxy One UI Devices.

## Two Views Architecture

1. **Customer View (Default at `/`)**:
   - Clean, friendly, mobile-first Samsung Galaxy support experience.
   - Designed for real phone owners with plain-language diagnostics, voice microphone input, screenshot diagnosis, numbered step checklists, "Open in Settings", "Send to my phone" QR codes, safety hazard warnings, and "Did this fix it?" feedback.
   - Completely free of technical jargon, latencies, model names, and raw `bixby://` URIs.

2. **Developer Console (`?console=1` or `Ctrl+Shift+D`)**:
   - Built for hackathon judges and Samsung DX engineers.
   - Access via URL parameter `?console=1`, keyboard shortcut `Ctrl+Shift+D`, or the "Developer console" link in the footer.
   - Contains all 6 technical tabs:
     - **Troubleshoot Workbench**: Full execution trace, stage timings, raw JSON response, AST validation, and Galaxy simulator.
     - **Paraphrase & Cache Lab**: Benchmarking across 10 linguistic registers verifying >=80% hit rate and <300ms latency.
     - **Deeplink Catalog**: Interactive explorer of 36 masked Galaxy settings URIs across 9 domains with BM25 retrieval.
     - **Support Team Dashboard (Analytics)**: Real-time telemetry, cache hit rates, average latency, and dollar savings vs. cloud AI.
     - **Evaluation (metrics.md)**: Automated gate verification (schema conformity, zero URL leaks, and baseline comparison table).
     - **API & cURL Sandbox**: Interactive REST API documentation and cURL testing sandbox.

## Automated Evaluation & Backend Endpoints

All backend endpoints are preserved and fully functional for automated test suites:

- `GET /health`: Health status, cache initialization, and catalog size.
- `POST /v1/troubleshoot`: Core pipeline processing natural-language complaints into validated One UI plans.
- `GET /api/metrics`: Raw markdown report adhering to Appendix C (`metrics.md`).
- `GET /api/benchmark`: JSON summary of system benchmark gates and architectural ablation.
- `POST /api/benchmark/run`: Re-runs the automated evaluation suite against reference scenarios.
- `GET /api/catalog`: Complete indexed Galaxy Settings deeplink catalog.
- `GET /api/cache/stats`: Fast-path semantic cache hit/miss and P95 latency statistics.
- `POST /api/cache/clear`: Resets and pre-warms semantic cache.
- `POST /api/feedback` & `POST /v1/feedback`: "Did this fix it?" user feedback loop recording.
- `GET /api/analytics` & `GET /v1/analytics`: Real-time operational support team analytics.
