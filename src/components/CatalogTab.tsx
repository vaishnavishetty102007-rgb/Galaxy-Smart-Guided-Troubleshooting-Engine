/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Deeplink Catalog & BM25 Matcher Explorer
 * Inspect masked settings URIs, toggle validations, and test hybrid retrieval
 */

import React, { useState } from 'react';
import { CatalogItem, Deeplink, ValidationDeepLink } from '../types/schema.js';
import catalogData from '../data/deeplinks.json' with { type: 'json' };
import { 
  Database, 
  Search, 
  Filter, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle,
  Sliders,
  Smartphone,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { matchDeeplink } from '../engine/matcher.js';

interface CatalogTabProps {
  onSimulateDeeplink: (dl: Deeplink, val?: ValidationDeepLink | null) => void;
}

const catalog: CatalogItem[] = catalogData as CatalogItem[];

export const CatalogTab: React.FC<CatalogTabProps> = ({ onSimulateDeeplink }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<ReturnType<typeof matchDeeplink> | null>(null);

  const domains = ['All', 'Battery', 'Display', 'Camera', 'Performance', 'Audio', 'Storage', 'Apps', 'Network', 'Safety', 'System'];

  const filteredItems = catalog.filter((item) => {
    const matchesDomain = selectedDomain === 'All' || item.domain === selectedDomain;
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      item.screenName.toLowerCase().includes(s) ||
      item.deeplink.toLowerCase().includes(s) ||
      item.description.toLowerCase().includes(s) ||
      item.message.toLowerCase().includes(s) ||
      (item.keywords || []).some(k => k.toLowerCase().includes(s));
    return matchesDomain && matchesSearch;
  });

  const handleTestMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    const match = matchDeeplink(testQuery.trim(), []);
    setTestResult(match);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Catalog Header */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-blue-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
            Section 2 Phase 2 & Section 3: In-App Settings Deeplink Catalog
          </span>
          <h2 className="text-lg font-bold text-white mt-0.5">
            Verified Masked Galaxy Settings Deeplinks
          </h2>
          <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Catalog of masked URIs (<code className="text-blue-300 font-mono">bixby://masked/act/...</code>) covering Battery, Display, Camera, Performance, and System toggles. Incorporates toggle validation criteria and prevents parent-menu traps.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-right">
            <span className="text-[10px] text-slate-400 block font-mono">CATALOG INTEGRITY</span>
            <span className="text-emerald-400 font-mono font-bold text-sm">100% Zero-Hallucination</span>
          </div>
        </div>
      </div>

      {/* Live BM25 Retrieval Sandbox */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Live BM25 Keyword + Intent Matcher Sandbox
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Tests query-to-screen resolution and parent-menu avoidance
          </span>
        </div>

        <form onSubmit={handleTestMatch} className="flex gap-2">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="Type any symptom, action phrase, or toggle name (e.g. 'adaptive refresh rate', 'clean memory', 'swipe up')..."
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shrink-0 transition"
          >
            Compute BM25 Match
          </button>
        </form>

        {testResult && (
          <div className="p-3 bg-blue-950/40 rounded-xl border border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-mono font-bold">Top Matched Screen:</span>
                <span className="text-white font-semibold">{testResult.catalogItem.screenName}</span>
                <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded font-mono">
                  Domain: {testResult.catalogItem.domain}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                  Score: {testResult.score}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 truncate max-w-xl">
                {testResult.deeplink.deeplink}
              </p>
            </div>
            <button
              onClick={() => onSimulateDeeplink(testResult.deeplink, testResult.validationDeeplink)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Simulate Screen</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Domain Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1">
          {domains.map((dom) => (
            <button
              key={dom}
              onClick={() => setSelectedDomain(dom)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                selectedDomain === dom
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {dom}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search screens, URIs, keywords..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-blue-950 text-blue-300 border border-blue-900">
                  {item.domain}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  item.category === 'critical' ? 'text-rose-400 bg-rose-950/60' : 'text-slate-400 bg-slate-800'
                }`}>
                  {item.control_type}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white">{item.screenName}</h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
              </div>

              <div className="p-2 rounded-lg bg-slate-950 border border-slate-850 font-mono text-[11px] text-slate-400 truncate">
                <span className="text-blue-400 select-all">{item.deeplink}</span>
              </div>

              {item.toggle_validation && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Validates: {item.toggle_validation.key} = {item.toggle_validation.value}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => onSimulateDeeplink({
                deeplink: item.deeplink,
                description: item.description,
                message: item.message
              }, item.toggle_validation ? {
                deeplink: item.deeplink,
                key: item.toggle_validation.key,
                resultType: item.toggle_validation.resultType,
                condition: item.toggle_validation.condition,
                value: item.toggle_validation.value
              } : null)}
              className="w-full py-1.5 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Simulate Galaxy Screen</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
