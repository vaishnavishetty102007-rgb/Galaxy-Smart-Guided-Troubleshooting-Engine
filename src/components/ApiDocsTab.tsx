/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * API Contract & Developer Sandbox Tab
 * Live cURL commands, contract documentation & HTTP verification
 */

import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, Play, CheckCircle2 } from 'lucide-react';

export const ApiDocsTab: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<unknown>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      setHealthStatus({ status: 'error', error: String(err) });
    } finally {
      setHealthLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const sampleCurl = `curl -X POST http://localhost:3000/v1/troubleshoot \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "The mobile phone swipe navigation moves up or down instead of left or right after downloading an app",
    "siis_response": "Navigate to and open Settings. Tap on Display. Tap on Navigation bar. Select your preferred navigation type between Buttons and Swipe gestures."
  }'`;

  const healthCurl = `curl -X GET http://localhost:3000/health`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-sm space-y-2">
        <span className="text-blue-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
          Section 5: Standardized REST API Service
        </span>
        <h2 className="text-lg font-bold text-white">
          System Interface & API Contract Specification
        </h2>
        <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
          Production REST microservice delivering sub-300ms validated JSON payloads with operational metadata (latency, cache hit flag, model identifier, and cost).
        </p>
      </div>

      {/* Endpoint 1: POST /v1/troubleshoot */}
      <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-blue-600 text-white font-mono text-xs font-bold">
              POST
            </span>
            <code className="text-sm font-mono text-slate-200 font-semibold">/v1/troubleshoot</code>
          </div>
          <span className="text-xs text-emerald-400 font-mono">200 OK (Pure JSON)</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Processes a customer complaint and returns an actionable, deconstructed troubleshooting plan with verified in-app Settings deeplinks.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Terminal cURL Execution:</span>
            <button
              onClick={() => copyToClipboard(sampleCurl, 'curl1')}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {copied === 'curl1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied === 'curl1' ? 'Copied' : 'Copy cURL'}</span>
            </button>
          </div>
          <pre className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {sampleCurl}
          </pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold">Request Body Parameters:</span>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-[11px]">
              <div>
                <span className="text-blue-400 font-bold">query</span> <span className="text-rose-400">(string, required)</span>:
                <p className="text-slate-400 font-sans mt-0.5">Informal, colloquial complaint from customer.</p>
              </div>
              <div>
                <span className="text-blue-400 font-bold">siis_response</span> <span className="text-slate-500">(string, optional)</span>:
                <p className="text-slate-400 font-sans mt-0.5">Optional pre-cleaned internal knowledge reference text. If omitted, engine uses pre-warmed cache.</p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 block font-semibold">Response Contract (Appendix B):</span>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1 text-[11px] text-slate-300">
              <div>&bull; <code className="text-emerald-400">query</code>: Original input string</div>
              <div>&bull; <code className="text-emerald-400">query_variations</code>: 8-10 generated paraphrases</div>
              <div>&bull; <code className="text-emerald-400">response.contexts[0].goal</code>: Strict syntax</div>
              <div>&bull; <code className="text-emerald-400">response.contexts[0].actions</code>: Screen-specific actions</div>
              <div>&bull; <code className="text-emerald-400">meta.latency_ms</code>: &le; 300 ms on cache hits</div>
            </div>
          </div>
        </div>
      </div>

      {/* Endpoint 2: GET /health */}
      <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-emerald-700 text-white font-mono text-xs font-bold">
              GET
            </span>
            <code className="text-sm font-mono text-slate-200 font-semibold">/health</code>
          </div>
          <button
            onClick={checkHealth}
            disabled={healthLoading}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Test Endpoint</span>
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Returns HTTP 200 <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded">{"{\"status\": \"ok\"}"}</code> when the caching layer, model connections, and vector indexes are fully initialized (Section 5).
        </p>

        {healthStatus ? (
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto">
            {JSON.stringify(healthStatus, null, 2)}
          </div>
        ) : (
          <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-400">
            {healthCurl}
          </pre>
        )}
      </div>
    </div>
  );
};
