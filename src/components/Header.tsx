/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Cpu, 
  Activity, 
  Database, 
  Sparkles, 
  FileCheck, 
  Terminal, 
  Code2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export type TabType = 'workbench' | 'paraphrases' | 'catalog' | 'analytics' | 'evaluation' | 'apidocs';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  systemHealth: {
    status: string;
    initialized: boolean;
    cacheEntries: number;
    catalogSize: number;
  } | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  systemHealth
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase font-mono">Samsung Electronics</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono">One UI 6.1</span>
              </div>
              <h1 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                Smart Guided Troubleshooting Engine
              </h1>
            </div>
          </div>

          {/* System Health & Status Indicator */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              <span className={`w-2 h-2 rounded-full ${systemHealth?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>Fast-Path Cache:</span>
              <span className="text-emerald-400 font-bold">&le; 300ms</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Catalog:</span>
              <span className="text-blue-400 font-bold">{systemHealth?.catalogSize || 23} URIs</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 border-t border-slate-800/60 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => setActiveTab('workbench')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition shrink-0 ${
              activeTab === 'workbench'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Troubleshoot Workbench
          </button>

          <button
            onClick={() => setActiveTab('paraphrases')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition shrink-0 ${
              activeTab === 'paraphrases'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Paraphrase & Cache Lab
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition shrink-0 ${
              activeTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Deeplink Catalog (~575 URIs)
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Support Analytics
          </button>

          <button
            onClick={() => setActiveTab('evaluation')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition shrink-0 ${
              activeTab === 'evaluation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Evaluation (metrics.md)
          </button>

          <button
            onClick={() => setActiveTab('apidocs')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition shrink-0 ${
              activeTab === 'apidocs'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            API & cURL Sandbox
          </button>
        </div>
      </div>
    </header>
  );
};
