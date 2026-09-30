# =============================================================================
# Galaxy Smart Guided Troubleshooting Engine - Dependency Reference
# =============================================================================
# NOTE: This is a Node.js + TypeScript project, NOT a Python project.
# The file pip reads (requirements.txt) does not apply here. The real, installable
# dependency manifest is `package.json`; install everything with:
#
#     npm install
#
# This file is a human-readable reference of what `npm install` pulls in.
# No Python packages are required.
# =============================================================================

# ---- Runtime ----------------------------------------------------------------
# Node.js >= 20 (LTS recommended; 22 is what @types/node targets)
# npm >= 10

# ---- Production dependencies (npm) ------------------------------------------
@google/genai@^2.4.0          # Gemini API SDK (query understanding + plan extraction; optional at runtime)
express@^4.21.2               # REST API server (/v1/troubleshoot, /health, /api/*)
dotenv@^17.2.3                # Loads GEMINI_API_KEY etc. from .env
react@^19.0.1                 # Frontend UI
react-dom@^19.0.1             # React DOM renderer
vite@^8.3.0                   # Dev server (middleware mode) + production bundler
@vitejs/plugin-react@^6.1.1   # React support for Vite
@tailwindcss/vite@^4.3.3      # Tailwind CSS v4 Vite plugin
lucide-react@^0.546.0         # Icon set
motion@^12.23.24              # Animations

# ---- Dev dependencies (npm) -------------------------------------------------
typescript@^7.0.2             # Type checking (npm run lint -> tsc --noEmit)
tsx@^4.21.0                   # Runs server.ts directly (dev + start scripts)
tailwindcss@^4.3.3            # Tailwind CSS core
autoprefixer@^10.4.21         # PostCSS vendor prefixes
esbuild@^0.25.0               # Bundler used by tooling
@types/node@^22.14.0          # Node typings
@types/express@^4.17.21       # Express typings
@types/react@^19.3.0          # React typings
@types/react-dom@^19.3.0      # React DOM typings

# ---- Environment variables (see .env.example) -------------------------------
# GEMINI_API_KEY   (optional) Enables Gemini-powered understanding/extraction.
#                  Without it the engine runs fully offline on rule-based logic.
# GEMINI_MODEL     (optional) Overrides the default model name.
# PORT             (optional) Server port, default 3000.
# NODE_ENV         (optional) Set to "production" to serve the built dist/ folder.
# APP_URL          (optional) Hosted URL (injected automatically on AI Studio).
