/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Galaxy Smart Support - Customer View
 * Friendly, accessible, mobile-first Samsung Galaxy self-repair experience.
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  TroubleshootResponse, 
  Deeplink, 
  ValidationDeepLink, 
  DeviceContext, 
  RiskLevel 
} from '../types/schema.js';
import { DeviceSimulator } from '../components/DeviceSimulator.js';
import { 
  Smartphone, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  Send, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertTriangle, 
  ShieldAlert, 
  ThumbsUp, 
  ThumbsDown, 
  QrCode, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Sparkles, 
  RotateCcw,
  Sliders,
  Wrench,
  Power,
  Calendar,
  PhoneCall,
  Settings2,
  Globe
} from 'lucide-react';

interface CustomerViewProps {
  onOpenConsole: () => void;
}

const EXAMPLE_CHIPS = [
  "Battery drains too fast",
  "Speaker is too quiet",
  "Phone is slow after update",
  "Camera photos are blurry",
  "फोन की बैटरी जल्दी खत्म हो रही है"
];

// Physical safety hazard check
function isPhysicalSafetyHazard(query: string): boolean {
  return /(bulg|swell|smoke|burn|fire|melt|hot to touch|expand|bloat|leaking battery)/i.test(query);
}

export const CustomerView: React.FC<CustomerViewProps> = ({ onOpenConsole }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [response, setResponse] = useState<TroubleshootResponse | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [listenSeconds, setListenSeconds] = useState(0);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [showPhonePreview, setShowPhonePreview] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState<string | null>(null);
  const [confirmedRiskActions, setConfirmedRiskActions] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const [activeDeeplink, setActiveDeeplink] = useState<Deeplink | null>(null);
  const [activeValidation, setActiveValidation] = useState<ValidationDeepLink | null>(null);
  const [showOriginalLanguage, setShowOriginalLanguage] = useState(false);

  // Device context
  const [deviceContext, setDeviceContext] = useState<DeviceContext>({
    model: 'Galaxy S24 Ultra',
    oneUiVersion: 'One UI 6.1',
    androidVersion: 'Android 14'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Keyboard shortcut listener: Ctrl+Shift+D opens developer console
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        onOpenConsole();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenConsole]);

  // Animated loading messages
  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      const timer = setTimeout(() => setLoadingStep(1), 700);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Voice speech recognition
  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechNotice('Voice input is not supported in this browser. Please type your problem.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
      clearInterval(timerRef.current);
      setListenSeconds(0);
      return;
    }

    try {
      setSpeechNotice(null);
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setListenSeconds(0);
        timerRef.current = setInterval(() => {
          setListenSeconds(s => s + 1);
        }, 1000);
      };

      recognition.onend = () => {
        setIsListening(false);
        clearInterval(timerRef.current);
      };

      recognition.onerror = (e: any) => {
        setIsListening(false);
        clearInterval(timerRef.current);
        if (e.error === 'not-allowed') {
          setSpeechNotice('Microphone access was denied. Please allow microphone permission in your browser.');
        } else if (e.error !== 'no-speech') {
          setSpeechNotice('Could not hear audio clearly. You can also type your problem.');
        }
      };

      recognition.onresult = (e: any) => {
        const text = e.results?.[0]?.[0]?.transcript;
        if (text) {
          setQuery(text);
          handleSubmit(text);
        }
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
      clearInterval(timerRef.current);
      setSpeechNotice('Could not start microphone. Please type your problem.');
    }
  };

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshotData(reader.result as string);
        if (!query.trim()) {
          setQuery('Issue shown on attached screenshot');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (textToSubmit?: string, clarificationAnswer?: string) => {
    const q = textToSubmit || query;
    if (!q.trim()) return;

    setLoading(true);
    setFeedback(null);
    setSpeechNotice(null);

    // If physical safety hazard detected upfront
    if (isPhysicalSafetyHazard(q)) {
      setLoading(false);
      setResponse({
        query: q,
        query_variations: [],
        response: {
          contexts: []
        },
        meta: {
          latency_ms: 2,
          cache_hit: true,
          model: 'safety-rule',
          cost_usd: 0,
          trace_id: 'safety_alert'
        }
      });
      return;
    }

    try {
      const res = await fetch('/v1/troubleshoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q.trim(),
          image_base64: screenshotData || undefined,
          device_context: deviceContext,
          clarification_answers: clarificationAnswer ? { user_choice: clarificationAnswer } : undefined
        })
      });

      const data = await res.json();
      setResponse(data);

      const firstAction = data.response?.contexts?.[0]?.actions?.[0];
      const firstDeeplink = firstAction?.stepGroups?.[0]?.actionableDeeplink;
      if (firstDeeplink) {
        setActiveDeeplink(firstDeeplink);
        setActiveValidation(firstAction?.stepGroups?.[0]?.validationDeeplink || null);
      }
    } catch (err) {
      console.error(err);
      setSpeechNotice('Something went wrong. Please try again or describe it a little differently.');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    setFeedback(helpful ? 'yes' : 'no');
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cacheKey: response?.query,
          helpful
        })
      });
    } catch (e) {
      // ignore
    }
  };

  const context = response?.response?.contexts?.[0];
  const clarificationQuestions = response?.response?.clarifyingQuestions;
  const isSafetyHazard = isPhysicalSafetyHazard(query) || isPhysicalSafetyHazard(response?.query || '');
  const isLowConfidenceOrEscalated = response?.response?.escalation?.needed || (context && context.score < 0.65);

  // Friendly summary derived without raw "Follow these steps to perform this ... Troubleshooting"
  const friendlySummary = context 
    ? `Here's how to resolve your ${context.title.toLowerCase()} problem on your ${deviceContext.model}`
    : "Recommended troubleshooting plan";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[720px] mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Galaxy Smart Support
            </h1>
          </div>

          {/* Device Chip */}
          <button
            onClick={() => setShowDevicePicker(!showDevicePicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            aria-label="Change device model or One UI version"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="truncate max-w-[170px]">{deviceContext.model}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </div>

        {/* Device Picker Drawer */}
        {showDevicePicker && (
          <div className="max-w-[720px] mx-auto px-4 pb-4 animate-fade-in">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Select Your Device</span>
                <button 
                  onClick={() => setShowDevicePicker(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Phone Model</label>
                  <select
                    value={deviceContext.model}
                    onChange={(e) => setDeviceContext({ ...deviceContext, model: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Galaxy S24 Ultra">Galaxy S24 Ultra</option>
                    <option value="Galaxy S23 FE">Galaxy S23 FE</option>
                    <option value="Galaxy Z Fold 5">Galaxy Z Fold 5</option>
                    <option value="Galaxy A55 5G">Galaxy A55 5G</option>
                    <option value="Galaxy S21">Galaxy S21</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">One UI Version</label>
                  <select
                    value={deviceContext.oneUiVersion}
                    onChange={(e) => setDeviceContext({ ...deviceContext, oneUiVersion: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="One UI 6.1">One UI 6.1</option>
                    <option value="One UI 6.0">One UI 6.0</option>
                    <option value="One UI 5.1">One UI 5.1</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[720px] w-full mx-auto px-4 py-6 space-y-6">
        {/* If no response yet: show Main Input Screen */}
        {!response && (
          <div className="space-y-6">
            {/* Hero Title */}
            <div className="text-center pt-2 pb-1 space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                What's wrong with your phone?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Describe the issue in your own words, speak it, or upload a screenshot. We'll show you the exact settings to fix it.
              </p>
            </div>

            {/* Input Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  rows={3}
                  maxLength={500}
                  placeholder="Describe the problem in your own words, in any language"
                  aria-label="Describe your phone problem"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none leading-relaxed min-h-[96px]"
                />
              </div>

              {/* Screenshot attached chip */}
              {screenshotData && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300">
                  <img src={screenshotData} alt="Attached screenshot" className="w-8 h-8 rounded-lg object-cover" />
                  <span className="font-medium">Screenshot attached</span>
                  <button 
                    onClick={() => setScreenshotData(null)}
                    className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                    aria-label="Remove screenshot"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Speech Notice Banner */}
              {speechNotice && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>{speechNotice}</span>
                  <button onClick={() => setSpeechNotice(null)} className="p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  {/* Voice Mic Button */}
                  <button
                    onClick={toggleListening}
                    aria-label={isListening ? "Stop listening" : "Speak your problem"}
                    className={`min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-semibold transition cursor-pointer border ${
                      isListening
                        ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    <span>{isListening ? `Listening (${listenSeconds}s)...` : 'Speak'}</span>
                  </button>

                  {/* Attach Screenshot Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add a screenshot of the issue"
                    className="min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="hidden sm:inline">Add screenshot</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleScreenshot}
                  />
                </div>

                {/* Primary Get Help Button */}
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading || !query.trim()}
                  aria-label="Get help with your phone problem"
                  className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <span>Get help</span>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Try an Example Chips */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block px-1">
                Try an example:
              </span>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => {
                      setQuery(chip);
                      handleSubmit(chip);
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-medium transition cursor-pointer text-left"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* While Loading: Friendly Animated Feedback */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in" aria-live="polite">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 animate-spin">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {loadingStep === 0 ? "Understanding your problem..." : "Finding the right settings..."}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Checking your device settings guide
              </p>
            </div>
          </div>
        )}

        {/* Result View */}
        {!loading && response && (
          <div className="space-y-5 animate-fade-in" aria-live="polite">
            {/* Top Bar with "Describe another problem" button */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setResponse(null);
                  setQuery('');
                  setScreenshotData(null);
                  setFeedback(null);
                }}
                className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>&larr; Describe another problem</span>
              </button>

              {/* Language Chip */}
              {response.meta.detected_language && response.meta.detected_language !== 'English' && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>Understood as: <strong>{response.meta.detected_language}</strong></span>
                </div>
              )}
            </div>

            {/* 1. Safety Banner (Physical / Battery swelling hazard) */}
            {isSafetyHazard && (
              <div className="p-5 bg-rose-50 dark:bg-rose-950/50 rounded-3xl border-2 border-rose-500/70 space-y-3">
                <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400">
                  <ShieldAlert className="w-6 h-6 shrink-0" />
                  <h3 className="text-base font-bold">Safety Warning: Physical Device Hazard</h3>
                </div>
                <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
                  If the battery or back cover is swollen, bulging, smoking, or emitting heat, stop using and charging the device immediately. Do not attempt software troubleshooting.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => alert('Demo Service Visit Booking initiated. A technician will contact you.')}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Book a priority service visit (demo)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Multi-Turn Clarification Dialogue */}
            {clarificationQuestions && clarificationQuestions.length > 0 && !context && (
              <div className="bg-amber-50 dark:bg-amber-950/40 rounded-3xl p-5 border border-amber-200 dark:border-amber-900/60 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                    Just a quick question to help you better:
                  </h3>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/80">
                    {clarificationQuestions[0]?.question || "When does this problem happen?"}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {clarificationQuestions[0]?.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSubmit(query, opt)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-slate-800 dark:text-slate-200 border border-amber-300 dark:border-amber-800 text-xs font-medium text-left transition cursor-pointer"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Friendly Summary Headline */}
            {!isSafetyHazard && context && (
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {friendlySummary}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Follow these simple steps in order. Tap "Open in Settings" to jump straight to the screen.
                </p>
              </div>
            )}

            {/* 2. Numbered Step Cards */}
            {!isSafetyHazard && context && context.actions && context.actions.length > 0 && (
              <div className="space-y-3.5">
                {context.actions.map((action, idx) => {
                  const isAuto = action.category === 'auto';
                  const isManual = action.category === 'manual';
                  const isCritical = action.category === 'critical';
                  const risk: RiskLevel = action.riskLevel || (isCritical ? 'destructive' : 'safe');
                  const isRisky = risk === 'caution' || risk === 'destructive';
                  const isConfirmed = confirmedRiskActions[action.actionName] || false;

                  const actionableDeeplink = action.stepGroups?.[0]?.actionableDeeplink;
                  const validation = action.stepGroups?.[0]?.validationDeeplink;

                  return (
                    <div
                      key={action.actionName + idx}
                      className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 transition"
                    >
                      {/* Card Header with Step Number & Tag */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                              {action.actionName}
                            </h4>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                              {action.description}
                            </p>
                          </div>
                        </div>

                        {/* Friendly Category Tag */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${
                          isAuto
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                            : isManual
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                        }`}>
                          {isAuto && <Sliders className="w-3 h-3" />}
                          {isManual && <Wrench className="w-3 h-3" />}
                          {isCritical && <Power className="w-3 h-3" />}
                          <span>
                            {isAuto ? 'Automatic' : isManual ? 'Do it yourself' : 'Restart / Reset'}
                          </span>
                        </span>
                      </div>

                      {/* Instruction Steps Checklist */}
                      <div className="pl-9 space-y-2">
                        <ul className="space-y-1.5">
                          {action.stepGroups?.flatMap((sg, sgIdx) => sg.steps.map((s, sIdx) => (
                            <li key={`${sgIdx}-${sIdx}`} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-1.5 shrink-0"></span>
                              <span>{s}</span>
                            </li>
                          )))}
                        </ul>
                      </div>

                      {/* Action Button & Confirmation Gate */}
                      {isAuto && actionableDeeplink && (
                        <div className="pl-9 pt-1 flex flex-wrap items-center gap-3">
                          {isRisky && !isConfirmed ? (
                            <div className="w-full p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2 text-xs">
                              <span className="text-amber-800 dark:text-amber-300">
                                This step may restart or change data. Are you ready?
                              </span>
                              <button
                                onClick={() => setConfirmedRiskActions({ ...confirmedRiskActions, [action.actionName]: true })}
                                className="min-h-[44px] px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shrink-0 transition"
                              >
                                I'm ready
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setActiveDeeplink(actionableDeeplink);
                                setActiveValidation(validation || null);
                                setShowPhonePreview(true);
                              }}
                              className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                              aria-label={`Open ${action.actionName} in Settings`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open in Settings</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Note on device menu differences */}
            {!isSafetyHazard && context && (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                Menu names may look slightly different depending on your Galaxy model.
              </p>
            )}

            {/* "Send to my phone" Button (opens QR code) */}
            {!isSafetyHazard && activeDeeplink && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Scan with your phone camera</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Open this exact setting directly on your phone</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold transition shrink-0"
                >
                  Send to my phone
                </button>
              </div>
            )}

            {/* QR Modal */}
            {showQrModal && activeDeeplink && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-xl border border-slate-200 dark:border-slate-800 animate-fade-in">
                  <div className="flex justify-end">
                    <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Open on Your Galaxy Phone</h4>
                  <div className="p-3 bg-white rounded-2xl shadow-inner inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`intent://${activeDeeplink.deeplink}#Intent;scheme=bixby;package=com.samsung.android.bixby.agent;end`)}`}
                      alt="Scan QR for Samsung Galaxy One UI Settings Deeplink"
                      className="w-44 h-44 rounded-lg"
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Open your phone's Camera app and point it at the code to jump right into the settings screen.
                  </p>
                  <button
                    onClick={() => setShowQrModal(false)}
                    className="w-full min-h-[44px] py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible Phone Preview Panel */}
            {!isSafetyHazard && activeDeeplink && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  onClick={() => setShowPhonePreview(!showPhonePreview)}
                  className="w-full min-h-[44px] px-5 py-3.5 flex items-center justify-between text-left text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>What it will look like on your phone</span>
                  </div>
                  {showPhonePreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showPhonePreview && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-800 h-[520px]">
                    <DeviceSimulator
                      activeDeeplink={activeDeeplink}
                      validationDeeplink={activeValidation}
                      hideTechnicalDetails={true}
                    />
                  </div>
                )}
              </div>
            )}

            {/* "Did this fix it?" Block */}
            {!isSafetyHazard && context && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Did this fix it?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleFeedback(true)}
                      className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                        feedback === 'yes'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Yes</span>
                    </button>
                    <button
                      onClick={() => handleFeedback(false)}
                      className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                        feedback === 'no'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span>No</span>
                    </button>
                  </div>
                </div>

                {/* Feedback Responses */}
                {feedback === 'yes' && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                    Thank you! We're glad this resolved your issue.
                  </p>
                )}

                {/* If No, or if low confidence: Contact Samsung Support Card */}
                {(feedback === 'no' || isLowConfidenceOrEscalated) && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                        <span>Contact Samsung Support</span>
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {isLowConfidenceOrEscalated 
                          ? "This looks like it may need a technician. We've prepared a case summary for you."
                          : "If none of these steps helped, our technical team is ready to assist you directly."}
                      </p>
                    </div>

                    {/* Auto-generated case note */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span>Case Summary</span>
                        <button
                          onClick={() => {
                            const note = `Customer Problem: ${query}\nDevice: ${deviceContext.model} (${deviceContext.oneUiVersion})\nSteps Attempted: ${context?.title}\nStatus: Unresolved, needs service review.`;
                            navigator.clipboard.writeText(note);
                            setCopiedNote(true);
                            setTimeout(() => setCopiedNote(false), 2000);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          {copiedNote ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedNote ? 'Copied' : 'Copy note'}</span>
                        </button>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px] leading-relaxed">
                        Customer reported: "{query}" on {deviceContext.model} ({deviceContext.oneUiVersion}). Self-troubleshooting steps for {context?.title} were attempted without resolution.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => alert('Demo Service Visit Booking initiated. A technician will contact you.')}
                        className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Book a service visit (demo)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200 dark:border-slate-900 text-center text-xs text-slate-400 dark:text-slate-600 space-y-1">
        <p>Hackathon prototype. Not an official Samsung product.</p>
        <p>
          <button
            onClick={onOpenConsole}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 underline transition cursor-pointer text-[11px]"
          >
            Developer console
          </button>
        </p>
      </footer>
    </div>
  );
};
