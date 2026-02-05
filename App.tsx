
import React, { useState, useEffect, useRef } from 'react';
import { MOCK_ALERTS, MOCK_RUNBOOKS } from './constants';
import { Alert, AlertSeverity, Message, CopilotState } from './types';
import { analyzeAlert, updateInvestigation } from './services/geminiService';

const App: React.FC = () => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSelectAlert = async (alert: Alert) => {
    if (selectedAlert?.id === alert.id) return;
    
    setSelectedAlert(alert);
    setMessages([]);
    setIsAnalyzing(true);

    try {
      const result = await analyzeAlert(alert, MOCK_RUNBOOKS);
      const initialMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Analysis complete. I've correlated the alert with Runbooks and Logs.`,
        state: result
      };
      setMessages([initialMessage]);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedAlert || isAnalyzing) return;

    const userFinding = inputValue.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userFinding
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsAnalyzing(true);

    try {
      const result = await updateInvestigation(selectedAlert, messages, userFinding, MOCK_RUNBOOKS);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Refining hypothesis based on your finding: "${userFinding}"`,
        state: result
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Update failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing]);

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-200 overflow-hidden">
      {/* Sidebar: Alert List */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-[#0f0f12]">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <i className="fa-solid fa-microchip text-indigo-500"></i>
            On-Call Copilot
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
          v0.2.1 • SRE Grade Reasoning Active
        </div>
      </div>

      {/* Main: Investigation Area */}
      <div className="flex-1 flex flex-col relative">
        {!selectedAlert ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <i className="fa-solid fa-radar fa-3x mb-4 text-slate-700 animate-pulse"></i>
            <p className="text-lg">Select an active alert to start investigation</p>
            <p className="text-sm mt-2 opacity-50">Monitoring cluster telemetry & logs...</p>
          </div>
        ) : (
          <>
            {/* Investigation Header */}
            <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0f0f12]/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                <div>
                  <h2 className="font-bold text-sm">{selectedAlert.title}</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Investigation ID: {selectedAlert.id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition-colors">
                  <i className="fa-solid fa-share-nodes mr-2"></i>Share Session
                </button>
                <button className="px-3 py-1.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 text-xs font-semibold transition-colors">
                  <i className="fa-solid fa-check mr-2"></i>Resolve
                </button>
              </div>
            </div>

            {/* Chat/Diagnostic History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Telemetry Snapshot */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    <i className="fa-solid fa-chart-line mr-2"></i>Live Telemetry Snapshot
                  </h3>
                  <span className="text-[10px] mono text-slate-500">t=0 at {new Date(selectedAlert.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <TelemetryItem label="CPU Usage" value={`${selectedAlert.telemetry.cpuUsage}%`} trend="up" />
                  <TelemetryItem label="DB Conns" value={selectedAlert.telemetry.dbConnections.toString()} trend="stable" />
                  <TelemetryItem label="Redis Latency" value={`${selectedAlert.telemetry.redisLatency}ms`} trend={selectedAlert.telemetry.redisLatency > 100 ? 'up' : 'stable'} />
                  <TelemetryItem label="Deploy" value={selectedAlert.telemetry.recentDeploy} trend="none" color="text-indigo-400" />
                  <TelemetryItem label="Thread Pool" value={`${selectedAlert.telemetry.threadPoolUsage}%`} trend="up" />
                  <TelemetryItem label="Error Rate" value={`${selectedAlert.telemetry.errorRate}%`} trend="up" color="text-red-400" />
                  <TelemetryItem label="Memory" value={`${selectedAlert.telemetry.memoryUsage}%`} trend="stable" />
                  <TelemetryItem label="Region" value={selectedAlert.region} trend="none" />
                </div>
              </div>

              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] ${msg.role === 'user' ? 'bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none' : 'w-full'}`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm font-medium">{msg.content}</p>
                    ) : (
                      <InvestigationResponse state={msg.state!} />
                    )}
                  </div>
                </div>
              ))}

              {isAnalyzing && (
                <div className="flex items-start gap-4 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                    <i className="fa-solid fa-brain text-indigo-400"></i>
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-800 rounded w-1/4"></div>
                    <div className="h-20 bg-slate-800 rounded w-full"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-4 bg-[#0f0f12] border-t border-slate-800">
              <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Share findings (e.g., 'Step 1 confirmed', 'Seeing timeouts in logs'...)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                  disabled={isAnalyzing}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isAnalyzing}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 bg-indigo-500 text-white rounded-lg flex items-center justify-center hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                >
                  <i className="fa-solid fa-arrow-up"></i>
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TelemetryItem: React.FC<{ label: string; value: string; trend: 'up' | 'down' | 'stable' | 'none'; color?: string }> = ({ label, value, trend, color }) => (
  <div className="bg-black/20 p-3 rounded-lg border border-slate-800/50">
    <p className="text-[9px] uppercase font-bold text-slate-500 mb-1">{label}</p>
    <div className="flex items-center justify-between">
      <span className={`text-xs font-bold mono ${color || 'text-slate-200'} truncate`}>{value}</span>
      {trend !== 'none' && (
        <i className={`fa-solid text-[10px] ${
          trend === 'up' ? 'fa-arrow-trend-up text-red-500' : 
          trend === 'down' ? 'fa-arrow-trend-down text-emerald-500' : 
          'fa-minus text-slate-600'
        }`}></i>
      )}
    </div>
  </div>
);

const InvestigationResponse: React.FC<{ state: CopilotState }> = ({ state }) => (
  <div className="space-y-6">
    <div className="flex gap-4">
      <div className="h-8 w-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center">
        <i className="fa-solid fa-brain text-white text-xs"></i>
      </div>
      <div className="flex-1 space-y-6">
        {/* Header Stats */}
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">
           <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-bullseye text-indigo-400"></i>
              <span>Confidence: {(state.confidence * 100).toFixed(0)}%</span>
           </div>
           <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-clock-rotate-left text-emerald-400"></i>
              <span>Time Saved: {state.estimatedTimeSavedMinutes}m</span>
           </div>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center">
              <i className="fa-solid fa-triangle-exclamation mr-2"></i>Alert Summary
            </h4>
            {state.evidenceLogs?.map(id => (
              <span key={id} className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded mono border border-slate-700">{id}</span>
            ))}
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{state.summary}</p>
        </section>

        <section className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center">
              <i className="fa-solid fa-lightbulb mr-2"></i>Hypothesis
            </h4>
            {state.evidenceRunbooks?.map(id => (
              <span key={id} className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded mono border border-indigo-500/30">{id}</span>
            ))}
          </div>
          <p className="text-slate-200 text-sm font-medium leading-relaxed italic">
            "{state.hypothesis}"
          </p>
        </section>

        <section>
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center">
            <i className="fa-solid fa-magnifying-glass-chart mr-2"></i>Investigation Plan
          </h4>
          <div className="space-y-3">
            {state.steps.map((step, idx) => (
              <div key={step.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/30 group-hover:bg-indigo-500 transition-colors"></div>
                <div className="flex gap-4">
                  <div className="h-6 w-6 rounded-full bg-slate-800 text-slate-400 flex-shrink-0 flex items-center justify-center text-[10px] font-bold border border-slate-700">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-100 mb-1">{step.action}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Reasoning</span>
                        <p className="text-[11px] text-slate-400 leading-tight">{step.reason}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">Success Metric</span>
                        <p className="text-[11px] text-emerald-400/80 leading-tight">{step.expectation}</p>
                      </div>
                    </div>
                    {/* Branching Logic Visual */}
                    <div className="mt-3 pt-3 border-t border-slate-800/50 flex gap-4 text-[9px] mono font-bold uppercase">
                       <span className="text-slate-500">IF PASS: <span className="text-emerald-500">{step.ifPassNext}</span></span>
                       <span className="text-slate-500">IF FAIL: <span className="text-red-500">{step.ifFailNext}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {(state.questionsToAsk?.length > 0 || state.missingSignals?.length > 0) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-6">
            {state.questionsToAsk?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Targeted Questions</h4>
                <ul className="space-y-1">
                  {state.questionsToAsk.map((q, i) => (
                    <li key={i} className="text-[11px] text-indigo-300 flex items-start gap-2">
                      <span className="text-indigo-500">•</span> {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {state.missingSignals?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Unobserved Signals</h4>
                <ul className="space-y-1">
                  {state.missingSignals.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-500 flex items-start gap-2 italic">
                      <span className="text-slate-700">?</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  </div>
);

export default App;
