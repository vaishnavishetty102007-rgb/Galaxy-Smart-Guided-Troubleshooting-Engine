/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Samsung Galaxy Troubleshooting Engine - Developer & Judges Console
 * Hidden by default; accessed via ?console=1, Ctrl+Shift+D, or footer link.
 */

import React, { useState } from 'react';
import { Header, TabType } from '../components/Header.js';
import { WorkbenchTab } from '../components/WorkbenchTab.js';
import { ParaphraseLabTab } from '../components/ParaphraseLabTab.js';
import { CatalogTab } from '../components/CatalogTab.js';
import { EvaluationTab } from '../components/EvaluationTab.js';
import { AnalyticsTab } from '../components/AnalyticsTab.js';
import { ApiDocsTab } from '../components/ApiDocsTab.js';
import { Deeplink, ValidationDeepLink } from '../types/schema.js';
import { ArrowLeft, Terminal, ShieldCheck, Cpu } from 'lucide-react';

interface ConsoleViewProps {
  onBackToCustomerView: () => void;
  systemHealth: {
    status: string;
    initialized: boolean;
    cacheEntries: number;
    catalogSize: number;
  } | null;
}

export const ConsoleView: React.FC<ConsoleViewProps> = ({
  onBackToCustomerView,
  systemHealth
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('workbench');
  const [activeSimulatorDeeplink, setActiveSimulatorDeeplink] = useState<Deeplink | null>(null);
  const [activeValidationDeeplink, setActiveValidationDeeplink] = useState<ValidationDeepLink | null>(null);

  const handleDeeplinkTriggered = (dl: Deeplink, val?: ValidationDeepLink | null) => {
    setActiveSimulatorDeeplink(dl);
    setActiveValidationDeeplink(val || null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Developer Console Top Banner */}
      <div className="bg-slate-900 border-b border-blue-900/60 px-4 sm:px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToCustomerView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition cursor-pointer"
            aria-label="Back to Customer View"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customer View</span>
          </button>
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-200 font-semibold">Developer & Evaluation Console</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 hidden sm:inline">Shortcut: Ctrl+Shift+D</span>
          </div>
        </div>

        {/* Technical Metric Badges */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Fast-Path &le; 300ms
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/80 text-blue-400 border border-blue-800/60">
            <ShieldCheck className="w-3 h-3" />
            0 URL Leaks
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            {systemHealth?.catalogSize || 36} Catalog URIs
          </span>
        </div>
      </div>

      {/* Console Tab Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealth={systemHealth}
      />

      {/* Console Tab Content */}
      <main className="flex-1">
        {activeTab === 'workbench' && (
          <WorkbenchTab
            onDeeplinkTriggered={handleDeeplinkTriggered}
            activeSimulatorDeeplink={activeSimulatorDeeplink}
            activeValidationDeeplink={activeValidationDeeplink}
          />
        )}

        {activeTab === 'paraphrases' && <ParaphraseLabTab />}

        {activeTab === 'catalog' && (
          <CatalogTab
            onSimulateDeeplink={(dl, val) => {
              handleDeeplinkTriggered(dl, val);
              setActiveTab('workbench');
            }}
          />
        )}

        {activeTab === 'analytics' && <AnalyticsTab />}

        {activeTab === 'evaluation' && <EvaluationTab />}

        {activeTab === 'apidocs' && <ApiDocsTab />}
      </main>

      {/* Console Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        <p>
          Samsung Electronics DX &bull; Guided Troubleshooting Engine Internal Console &bull; Press Ctrl+Shift+D to toggle
        </p>
      </footer>
    </div>
  );
};
