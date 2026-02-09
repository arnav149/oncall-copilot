
import React, { useState, useEffect, useRef } from 'react';
import { MOCK_ALERTS, MOCK_RUNBOOKS } from './constants';
import { Alert, AlertSeverity, Message, CopilotState, ToolCall } from './types';
import { runAutonomousInvestigation } from './services/geminiService';

const App: React.FC = () => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [copilotState, setCopilotState] = useState<CopilotState | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const startInvestigation = async (alert: Alert) => {
    setSelectedAlert(alert);
    setCopilotState(null);
    setIsAnalyzing(true);

    try {
      await runAutonomousInvestigation(alert, MOCK_RUNBOOKS, (state) => {
        setCopilotState(state);
      });
    } catch (error) {
      console.error("Investigation failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectAlert = (alert: Alert) => {
    if (selectedAlert?.id === alert.id) return;
    startInvestigation(alert);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [copilotState, isAnalyzing]);

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-200 overflow-hidden">
      {/* Sidebar: Alert List */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-[#0f0f12]">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <i className="fa-solid fa-microchip text-indigo-500"></i>
            Agentic On-Call Copilot
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">Active Alerts</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {MOCK_ALERTS.map(alert => (
            <button
              key={alert.id}
              onClick={() => handleSelectAlert(alert)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selectedAlert?.id === alert.id 
                  ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/50' 
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  alert.severity === AlertSeverity.CRITICAL ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                  {alert.severity}
                </span>
                <span className="text-[10px] text-slate-500 mono">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <h3 className="font-semibold text-sm leading-tight mb-1">{alert.title}</h3>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="mono">{alert.service}</span>
                <span>•</span>
                <span>{alert.region}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="p-4 bg-slate-900/30 border-t border-slate-800 text-[10px] text-slate-600 italic">
          v0.3.0 • Autonomous Agent Active
        </div>
      </div>

      {/* Main: Investigation Area */}
      <div className="flex-1 flex flex-col relative">
        {!selectedAlert ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <i className="fa-solid fa-radar fa-3x mb-4 text-slate-700 animate-pulse"></i>
            <p className="text-lg">Select an alert to trigger investigation</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0f0f12]/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className={`h-2 w-2 rounded-full ${isAnalyzing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
                <div>
                  <h2 className="font-bold text-sm">{selectedAlert.title}</h2>
                  <p className="text-[10px] text-slate-500 uppercase">Agent Session: {selectedAlert.id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => startInvestigation(selectedAlert)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
                  disabled={isAnalyzing}
                >
                  <i className="fa-solid fa-rotate-right mr-2"></i>Re-run
                </button>
                <button className="px-3 py-1.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                  <i className="fa-solid fa-check mr-2"></i>Resolve
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Investigation Log (Tool Usage) */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-800/50 flex items-center justify-between border-b border-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Autonomous Investigation Run</span>
                  <span className="text-[10px] mono text-indigo-400">
                    {isAnalyzing ? `Step ${copilotState?.toolCalls.length || 0}/8 Running...` : `Complete (${copilotState?.toolCalls.length || 0} checks)`}
                  </span>
                </div>
                <div className="p-3 space-y-1 max-h-48 overflow-y-auto bg-black/20">
                  {copilotState?.toolCalls.map((call, idx) => (
                    <div key={call.id} className="flex items-center justify-between text-[11px] py-1 border-b border-white/5 last:border-0 group">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-slate-500 mono w-12">{call.id}</span>
                        <span className="text-indigo-300 font-semibold truncate">{call.tool}({JSON.stringify(call.args)})</span>
                      </div>
                      <ToolResultPopover result={call.result} />
                    </div>
                  ))}
                  {isAnalyzing && (
                    <div className="flex items-center gap-3 text-[11px] py-1 animate-pulse">
                      <span className="text-slate-500 mono w-12">NEXT</span>
                      <span className="text-slate-600 italic">Thinking...</span>
                    </div>
                  )}
                </div>
              </div>

              {copilotState && <InvestigationOutput state={copilotState} />}
              
              <div ref={chatEndRef} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ToolResultPopover: React.FC<{ result: any }> = ({ result }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-[9px] bg-slate-800 hover:bg-slate-700 px-1.5 rounded text-slate-400 transition-colors"
      >
        Result <i className={`fa-solid fa-chevron-${isOpen ? 'up' : 'down'} ml-1`}></i>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-6 z-20 w-80 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-2xl">
          <pre className="text-[10px] mono text-indigo-200 overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

const InvestigationOutput: React.FC<{ state: CopilotState }> = ({ state }) => {
  // Normalize confidence: if > 1, assume it's already a percentage (e.g., 95)
  const confidenceVal = state.confidence > 1 ? state.confidence : state.confidence * 100;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">
         <div className="flex items-center gap-1.5">
            <i className="fa-solid fa-bullseye text-indigo-400"></i>
            <span>Confidence: {confidenceVal.toFixed(0)}%</span>
         </div>
         <div className="flex items-center gap-1.5 ml-auto">
            <i className="fa-solid fa-clock-rotate-left text-emerald-400"></i>
            <span>Time Saved: {state.estimatedTimeSavedMinutes}m</span>
         </div>
      </div>

      <section>
        <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2 flex items-center">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>Alert Summary
        </h4>
        <p className="text-slate-300 text-sm">{state.summary}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <i className="fa-solid fa-lightbulb fa-3x"></i>
          </div>
          <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">Primary Hypothesis</h4>
          <p className="text-slate-100 text-sm font-semibold">{state.hypothesis}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {state.evidenceLogs?.map(e => <span key={e} className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded mono">{e}</span>)}
          </div>
        </section>

        {state.alternativeHypothesis && (
          <section className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl opacity-60">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Alternative</h4>
            <p className="text-slate-400 text-sm italic">{state.alternativeHypothesis}</p>
          </section>
        )}
      </div>

      {state.commsDraft && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center">
              <i className="fa-brands fa-slack mr-2"></i>Incident Channel Update
            </h4>
            <button className="text-[9px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded">Copy</button>
          </div>
          <div className="bg-black/40 p-3 rounded mono text-[11px] text-slate-300 whitespace-pre-wrap border border-slate-800">
            {state.commsDraft}
          </div>
        </section>
      )}
    </div>
  );
};

export default App;
