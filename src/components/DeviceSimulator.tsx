/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Samsung Galaxy One UI Device Simulator
 * Renders realistic in-app One UI Settings screens corresponding to Bixby Deeplinks
 */

import React, { useState } from 'react';
import { Deeplink, ValidationDeepLink } from '../types/schema.js';
import { 
  ChevronLeft, 
  Search, 
  MoreVertical, 
  Check, 
  Smartphone, 
  ShieldCheck, 
  RefreshCw,
  Power,
  Sliders,
  Battery,
  Sun,
  Camera,
  Cpu,
  Wifi,
  QrCode,
  X
} from 'lucide-react';

interface DeviceSimulatorProps {
  activeDeeplink: Deeplink | null;
  validationDeeplink?: ValidationDeepLink | null;
  onClose?: () => void;
  hideTechnicalDetails?: boolean;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({
  activeDeeplink,
  validationDeeplink,
  onClose,
  hideTechnicalDetails = false
}) => {
  // Local interactive state inside simulated Galaxy settings screen
  const [toggleActive, setToggleActive] = useState<boolean>(true);
  const [selectedRadio, setSelectedRadio] = useState<string>('standard');
  const [sliderVal, setSliderVal] = useState<number>(65);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  if (!activeDeeplink) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 ring-1 ring-blue-500/20">
          <Smartphone className="w-8 h-8" />
        </div>
        <h4 className="text-slate-200 font-semibold text-base mb-1">One UI Simulator Ready</h4>
        <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
          Tap any <code className="text-blue-400 bg-blue-950/60 px-1 py-0.5 rounded">bixby://</code> deeplink button to simulate opening the verified Samsung Settings screen.
        </p>
      </div>
    );
  }

  const uri = activeDeeplink.deeplink;
  const isNav = uri.includes('navigation_bar');
  const isMotion = uri.includes('motion_smoothness');
  const isBrightness = uri.includes('display_brightness');
  const isBatteryLimits = uri.includes('background_usage_limits');
  const isCharging = uri.includes('charging_settings');
  const isMemory = uri.includes('memory_management');
  const isTouch = uri.includes('touch_sensitivity');
  const isCamera = uri.includes('camera');
  const isAudio = uri.includes('sound') || uri.includes('volume') || uri.includes('audio');
  const isStorage = uri.includes('storage');
  const isSecurity = uri.includes('security') || uri.includes('auto_blocker');
  const isCritical = uri.includes('restart') || uri.includes('reset') || uri.includes('safe_mode');

  return (
    <div className="relative flex flex-col h-full bg-slate-950 rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden font-sans select-none">
      {/* Galaxy Top Bezel & Camera Punch Hole */}
      <div className="relative bg-slate-950 px-6 pt-3 pb-2 flex items-center justify-between text-[11px] text-slate-300 border-b border-slate-900">
        <span className="font-semibold tracking-tight">12:45</span>
        {/* Front Camera cutout */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2.5 w-3.5 h-3.5 rounded-full bg-black ring-1 ring-slate-800"></div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Wifi className="w-3 h-3" />
          <span className="text-[10px] font-mono">5G</span>
          <Battery className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Deeplink Header Pill Banner */}
      <div className="bg-blue-950/80 px-4 py-2 border-b border-blue-900/50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          <span className={`text-blue-300 truncate ${hideTechnicalDetails ? 'text-xs font-medium' : 'font-mono text-[11px]'}`}>
            {hideTechnicalDetails ? 'Phone Preview' : activeDeeplink.deeplink}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 font-medium transition cursor-pointer"
            title="Scan QR to open settings screen on physical Galaxy device"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Send to Phone</span>
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800/80"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* QR Code Modal for Physical Android Device */}
      {showQrModal && (
        <div className="absolute inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <button 
            onClick={() => setShowQrModal(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="p-3 bg-white rounded-2xl shadow-xl mb-3">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`intent://${activeDeeplink.deeplink}#Intent;scheme=bixby;package=com.samsung.android.bixby.agent;end`)}`}
              alt="Scan QR for Samsung Galaxy One UI Settings Deeplink"
              className="w-44 h-44 rounded-lg"
            />
          </div>
          <h4 className="text-white font-bold text-sm">Send to Galaxy Phone</h4>
          <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
            Scan with your Samsung Camera app to open this exact Settings screen directly on your phone.
          </p>
          {!hideTechnicalDetails && (
            <div className="mt-3 p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono text-[10px] text-blue-300 max-w-xs truncate">
              {activeDeeplink.deeplink}
            </div>
          )}
          <button 
            onClick={() => setShowQrModal(false)}
            className="mt-4 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
          >
            Done
          </button>
        </div>
      )}

      {/* One UI Settings Screen Header */}
      <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="text-slate-300 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-white font-medium text-sm">
              {activeDeeplink.description || 'Samsung Settings'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
              {activeDeeplink.message || 'One UI 6.1 Native Setting'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Search className="w-4 h-4" />
          <MoreVertical className="w-4 h-4" />
        </div>
      </div>

      {/* Screen Interactive Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950 text-slate-200">
        {/* Navigation Bar Screen */}
        {isNav && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-2">Navigation Type</span>
              <div 
                onClick={() => setSelectedRadio('buttons')}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                  selectedRadio === 'buttons' ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-white">Buttons</p>
                  <p className="text-xs text-slate-400">Recents, Home, Back</p>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedRadio === 'buttons' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'}`}>
                  {selectedRadio === 'buttons' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </div>

              <div 
                onClick={() => setSelectedRadio('gestures')}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition mt-2 ${
                  selectedRadio === 'gestures' ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-white">Swipe gestures</p>
                  <p className="text-xs text-slate-400">Swipe up or sideways to navigate</p>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedRadio === 'gestures' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'}`}>
                  {selectedRadio === 'gestures' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm font-medium text-white">Gesture hint</p>
                <p className="text-xs text-slate-400">Show line where to swipe</p>
              </div>
              <button 
                onClick={() => setToggleActive(!toggleActive)}
                className={`w-11 h-6 rounded-full transition p-1 flex items-center ${toggleActive ? 'bg-blue-500 justify-end' : 'bg-slate-700 justify-start'}`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow"></div>
              </button>
            </div>
          </div>
        )}

        {/* Motion Smoothness Screen */}
        {isMotion && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-2">Refresh Rate</span>
              <div 
                onClick={() => setSelectedRadio('adaptive')}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                  selectedRadio === 'adaptive' ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-white">Adaptive (up to 120 Hz)</p>
                  <p className="text-xs text-slate-400">Get smoother animations and scrolling</p>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedRadio === 'adaptive' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'}`}>
                  {selectedRadio === 'adaptive' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </div>

              <div 
                onClick={() => setSelectedRadio('standard')}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition mt-2 ${
                  selectedRadio === 'standard' ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-white">Standard (60 Hz)</p>
                  <p className="text-xs text-slate-400">Conserves battery life and stops display flicker</p>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedRadio === 'standard' ? 'border-blue-400 bg-blue-500' : 'border-slate-600'}`}>
                  {selectedRadio === 'standard' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Background Usage Limits */}
        {isBatteryLimits && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-slate-900 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm font-medium text-white">Put unused apps to sleep</p>
                <p className="text-xs text-slate-400">Limits battery usage for apps you don't use often</p>
              </div>
              <button 
                onClick={() => setToggleActive(!toggleActive)}
                className={`w-11 h-6 rounded-full transition p-1 flex items-center ${toggleActive ? 'bg-blue-500 justify-end' : 'bg-slate-700 justify-start'}`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow"></div>
              </button>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Sleeping apps</span>
                <span className="text-blue-400 font-mono">14 apps</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-300">Deep sleeping apps</span>
                <span className="text-blue-400 font-mono">29 apps</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-300">Never sleeping apps</span>
                <span className="text-slate-500 font-mono">2 apps</span>
              </div>
            </div>
          </div>
        )}

        {/* Touch Sensitivity */}
        {isTouch && (
          <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Touch sensitivity</p>
              <p className="text-xs text-slate-400">Increase touch screen sensitivity for use with screen protectors</p>
            </div>
            <button 
              onClick={() => setToggleActive(!toggleActive)}
              className={`w-11 h-6 rounded-full transition p-1 flex items-center ${toggleActive ? 'bg-blue-500 justify-end' : 'bg-slate-700 justify-start'}`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow"></div>
            </button>
          </div>
        )}

        {/* Memory Cleaning */}
        {isMemory && (
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-white">4.8 GB</span>
                <span className="text-xs text-slate-400 ml-1">/ 12 GB available</span>
              </div>
              <button 
                onClick={() => setToggleActive(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                Clean now (+1.2 GB)
              </button>
            </div>
            <p className="text-xs text-slate-400">RAM Plus: 8 GB allocated virtual memory</p>
          </div>
        )}

        {/* Critical Operations (Restart / Safe Mode) */}
        {isCritical && (
          <div className="p-4 bg-rose-950/40 rounded-xl border border-rose-800/50 space-y-3 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400">
              <Power className="w-6 h-6" />
            </div>
            <h4 className="text-white font-semibold text-sm">Critical System Operation</h4>
            <p className="text-xs text-rose-300/80 leading-relaxed">
              This action triggers a system reload or reboot. As per Section 4.1, this disruptive step is sequenced LAST in the troubleshooting plan.
            </p>
            <button className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg">
              Confirm Diagnostic Reboot
            </button>
          </div>
        )}

        {/* Audio & Sounds Screen */}
        {isAudio && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">Sound Mode</span>
              <div className="grid grid-cols-3 gap-2">
                {['sound', 'vibrate', 'mute'].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setSelectedRadio(mode)}
                    className={`py-2 text-xs font-medium rounded-lg capitalize border ${
                      selectedRadio === mode
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Media & Speaker Volume</span>
                <span className="text-blue-400 font-mono">{sliderVal}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderVal}
                onChange={e => setSliderVal(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm font-medium text-white">Dolby Atmos Audio</p>
                <p className="text-xs text-slate-400">Spatial surround sound for media</p>
              </div>
              <button 
                onClick={() => setToggleActive(!toggleActive)}
                className={`w-11 h-6 rounded-full transition p-1 flex items-center ${toggleActive ? 'bg-blue-500 justify-end' : 'bg-slate-700 justify-start'}`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow"></div>
              </button>
            </div>
          </div>
        )}

        {/* Device Care Storage Screen */}
        {isStorage && (
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-white">184 GB</span>
                <span className="text-xs text-slate-400 ml-1">/ 256 GB used</span>
              </div>
              <button 
                onClick={() => setToggleActive(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                Empty Trash
              </button>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full w-[72%]"></div>
            </div>
            <p className="text-xs text-slate-400">Gallery Trash: 4.2 GB recoverable space</p>
          </div>
        )}

        {/* Auto Blocker Security Screen */}
        {isSecurity && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div>
                <p className="text-sm font-medium text-white">Auto Blocker</p>
                <p className="text-xs text-slate-400">Block unauthorized apps and USB malware</p>
              </div>
              <button 
                onClick={() => setToggleActive(!toggleActive)}
                className={`w-11 h-6 rounded-full transition p-1 flex items-center ${toggleActive ? 'bg-blue-500 justify-end' : 'bg-slate-700 justify-start'}`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow"></div>
              </button>
            </div>
          </div>
        )}

        {/* Fallback / Generic screen */}
        {!isNav && !isMotion && !isBatteryLimits && !isTouch && !isMemory && !isAudio && !isStorage && !isSecurity && !isCritical && (
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-blue-400">
              <Sliders className="w-5 h-5" />
              <span className="text-sm font-semibold text-white">{activeDeeplink.description}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {activeDeeplink.message || 'Direct in-app settings target opened via verified Samsung Deeplink.'}
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-300">
              <span>Status</span>
              <span className="text-emerald-400 font-mono">Screen Active</span>
            </div>
          </div>
        )}

        {/* Validation Deeplink Status Box */}
        {validationDeeplink && (
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-300">
            {hideTechnicalDetails ? (
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>We'll verify that the setting changed on your phone</span>
              </div>
            ) : (
              <div className="font-mono text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Toggle Validation Rule</span>
                </div>
                <div>Key: <span className="text-slate-200">{validationDeeplink.key}</span></div>
                <div>Target: <span className="text-slate-200">{validationDeeplink.condition} '{validationDeeplink.value}'</span></div>
                <div>Type: <span className="text-slate-200">{validationDeeplink.resultType}</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Galaxy Bottom Gesture Bar */}
      <div className="py-2.5 bg-slate-950 flex justify-center border-t border-slate-900">
        <div className="w-28 h-1 bg-slate-600 rounded-full"></div>
      </div>
    </div>
  );
};
