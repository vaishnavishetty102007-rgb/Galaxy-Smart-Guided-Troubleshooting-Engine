/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Samsung Electronics Smart Guided Troubleshooting Engine
 * Transforming Vague Galaxy Device Complaints into Deeplinked, One-Tap Troubleshooting Plans
 * 
 * Two Views Architecture:
 * 1. Customer View (Default at /): Clean, friendly, mobile-first Samsung Galaxy support experience
 * 2. Developer Console: Hidden, accessed via ?console=1, Ctrl+Shift+D, or footer link
 */

import React, { useState, useEffect } from 'react';
import { CustomerView } from './views/CustomerView.js';
import { ConsoleView } from './views/ConsoleView.js';

export default function App() {
  const [isConsoleMode, setIsConsoleMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('console') === '1';
    }
    return false;
  });

  const [systemHealth, setSystemHealth] = useState<{
    status: string;
    initialized: boolean;
    cacheEntries: number;
    catalogSize: number;
  } | null>(null);

  useEffect(() => {
    // Health check for caching layer & catalog
    fetch('/health')
      .then(res => res.json())
      .then(data => {
        setSystemHealth({
          status: data.status,
          initialized: data.initialized,
          cacheEntries: data.cache_entries || 5,
          catalogSize: data.catalog_size || 36
        });
      })
      .catch(err => {
        console.error('Health check error:', err);
      });
  }, []);

  // Listen to browser navigation / popstate
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setIsConsoleMode(params.get('console') === '1');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsConsoleMode(prev => {
          const next = !prev;
          const url = new URL(window.location.href);
          if (next) {
            url.searchParams.set('console', '1');
          } else {
            url.searchParams.delete('console');
          }
          window.history.pushState({}, '', url.toString());
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenConsole = () => {
    setIsConsoleMode(true);
    const url = new URL(window.location.href);
    url.searchParams.set('console', '1');
    window.history.pushState({}, '', url.toString());
  };

  const handleBackToCustomerView = () => {
    setIsConsoleMode(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('console');
    window.history.pushState({}, '', url.toString());
  };

  if (isConsoleMode) {
    return (
      <ConsoleView
        onBackToCustomerView={handleBackToCustomerView}
        systemHealth={systemHealth}
      />
    );
  }

  return (
    <CustomerView
      onOpenConsole={handleOpenConsole}
    />
  );
}
