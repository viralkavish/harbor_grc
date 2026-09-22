import { useState, useEffect } from 'react';
import { Bot, Check, Play, Copy, RefreshCw, Terminal, Sparkles, Activity, Shield } from 'lucide-react';
import { Dialog } from './Dialog';
import { getModelContext } from '../lib/webmcp/polyfill';
import type { WebMcpTool, WebMcpToolCallLog } from '../lib/webmcp/types';
import type { Notify } from '../lib/types';

interface WebMcpInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  notify: Notify;
}

export function WebMcpInspectorModal({ isOpen, onClose, notify }: WebMcpInspectorModalProps) {
  const [tools, setTools] = useState<WebMcpTool[]>([]);
  const [activeTab, setActiveTab] = useState<'tools' | 'console' | 'logs'>('tools');
  const [selectedToolName, setSelectedToolName] = useState<string>('get_workspace_overview');
  const [argsJson, setArgsJson] = useState<string>('{}');
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<any | null>(null);
  const [execError, setExecError] = useState<string>('');
  const [logs, setLogs] = useState<WebMcpToolCallLog[]>([]);
  const [copied, setCopied] = useState(false);

  const loadTools = async () => {
    const mc = getModelContext();
    const loaded = await mc.getTools();
    setTools(loaded);
  };

  useEffect(() => {
    if (isOpen) {
      loadTools();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleExecuted = (ev: any) => {
      const detail = ev.detail;
      const logEntry: WebMcpToolCallLog = {
        id: `call-${Date.now()}-${Math.random()}`,
        toolName: detail.name,
        timestamp: new Date().toLocaleTimeString(),
        arguments: detail.arguments,
        result: detail.result,
        error: detail.error,
        durationMs: detail.durationMs
      };
      setLogs(prev => [logEntry, ...prev.slice(0, 49)]);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('webmcp:tool-executed', handleExecuted);
      return () => window.removeEventListener('webmcp:tool-executed', handleExecuted);
    }
  }, []);

  const handleSelectTool = (name: string) => {
    setSelectedToolName(name);
    const t = tools.find(x => x.name === name);
    if (!t) return;

    // Default template args
    if (name === 'navigate_view') {
      setArgsJson(JSON.stringify({ view: 'frameworks' }, null, 2));
    } else if (name === 'list_records') {
      setArgsJson(JSON.stringify({ resource: 'controls', q: 'mfa' }, null, 2));
    } else if (name === 'create_record') {
      setArgsJson(JSON.stringify({
        resource: 'tasks',
        payload: { title: 'Review quarterly SOC 2 evidence', priority: 'high', status: 'todo' }
      }, null, 2));
    } else if (name === 'evaluate_policy_jev') {
      setArgsJson(JSON.stringify({
        title: 'MFA Enforcement Policy',
        content: 'Multi-Factor Authentication (MFA) via authenticator app or security key is strictly mandatory for 100% of workforce and administrative access.'
      }, null, 2));
    } else if (name === 'auto_fill_questionnaire') {
      setArgsJson(JSON.stringify({ prompt: 'How does your organization enforce multi-factor authentication and data encryption?' }, null, 2));
    } else if (name === 'analyze_vendor_soc2') {
      setArgsJson(JSON.stringify({ vendor_name: 'Amazon Web Services', report_summary: 'Unqualified SOC 2 Type II examination with clean operational controls.' }, null, 2));
    } else {
      setArgsJson('{}');
    }
    setExecResult(null);
    setExecError('');
  };

  const handleExecuteTool = async () => {
    setExecuting(true);
    setExecResult(null);
    setExecError('');
    const mc = getModelContext();

    try {
      let parsedArgs = {};
      if (argsJson.trim()) {
        parsedArgs = JSON.parse(argsJson);
      }
      const res = await mc.executeTool(selectedToolName, parsedArgs);
      setExecResult(res);
      notify(`WebMCP Tool '${selectedToolName}' executed successfully`);
    } catch (err: any) {
      setExecError(err.message || 'Execution error');
      notify(`WebMCP Error: ${err.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyCodeSnippet = () => {
    const snippet = `// Call WebMCP tool from any connected agent or browser script:\nawait document.modelContext.executeTool('${selectedToolName}', ${argsJson});`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const currentTool = tools.find(t => t.name === selectedToolName);

  return (
    <Dialog
      title="WebMCP Agent Control & Tool Inspector"
      subtitle="Expose live website capabilities and in-browser state directly to AI agents via the W3C WebML / Chrome WebMCP standard."
      onClose={onClose}
      wide
    >
      <div className="harbor-view-modal" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Status Header Banner */}
        <div style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>WebMCP Standard Active</strong>
                <span style={{ fontSize: '11px', background: 'var(--success-light)', color: 'var(--success)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                  ● Live Context Ready
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Target: <code className="mono">document.modelContext</code> &nbsp;·&nbsp; {tools.length} Tools Registered &nbsp;·&nbsp; JSON-RPC <code className="mono">/api/mcp</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`button button-sm ${activeTab === 'tools' ? 'button-primary' : ''}`}
              onClick={() => setActiveTab('tools')}
            >
              Tools ({tools.length})
            </button>
            <button
              className={`button button-sm ${activeTab === 'console' ? 'button-primary' : ''}`}
              onClick={() => { setActiveTab('console'); handleSelectTool(selectedToolName); }}
            >
              <Terminal size={12} /> Agent Console
            </button>
            <button
              className={`button button-sm ${activeTab === 'logs' ? 'button-primary' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <Activity size={12} /> Live Log ({logs.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Registered Tools */}
        {activeTab === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                These tools are automatically discoverable by WebMCP browser agents, extensions, and external MCP clients:
              </span>
              <button className="button button-sm" onClick={loadTools}>
                <RefreshCw size={12} /> Reload
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px', maxHeight: '480px', overflowY: 'auto' }}>
              {tools.map(t => (
                <div
                  key={t.name}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <code className="mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                        {t.name}
                      </code>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: t.annotations?.readOnlyHint ? 'var(--surface-raised)' : 'rgba(239, 68, 68, 0.15)',
                        color: t.annotations?.readOnlyHint ? 'var(--muted)' : 'var(--danger)',
                        border: '1px solid var(--border)'
                      }}>
                        {t.annotations?.readOnlyHint ? 'read-only' : 'mutating'}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.4, margin: 0 }}>
                      {t.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      Params: {Object.keys(t.inputSchema?.properties || {}).join(', ') || 'none'}
                    </small>
                    <button
                      className="button button-sm"
                      onClick={() => {
                        handleSelectTool(t.name);
                        setActiveTab('console');
                      }}
                    >
                      <Play size={11} /> Test Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Interactive Agent Console */}
        {activeTab === 'console' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', minHeight: '400px' }}>
            {/* Left: Tool Selection & Arguments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="field">
                <span>Select Tool to Execute</span>
                <select
                  value={selectedToolName}
                  onChange={e => handleSelectTool(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--surface-raised)', color: 'var(--ink)', border: '1px solid var(--border)' }}
                >
                  {tools.map(t => (
                    <option key={t.name} value={t.name}>{t.name} — {t.description.slice(0, 55)}...</option>
                  ))}
                </select>
              </div>

              {currentTool && (
                <div style={{ background: 'var(--surface-raised)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{currentTool.name}</div>
                  <div style={{ color: 'var(--muted)', marginTop: '2px' }}>{currentTool.description}</div>
                </div>
              )}

              <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span>Input Arguments (JSON)</span>
                  <button className="link-button" onClick={handleCopyCodeSnippet} style={{ fontSize: '11px' }}>
                    {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied code' : 'Copy JS code'}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={argsJson}
                  onChange={e => setArgsJson(e.target.value)}
                  style={{
                    width: '100%',
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    padding: '10px',
                    borderRadius: '6px',
                    background: 'var(--main-bg)',
                    color: 'var(--ink)',
                    border: '1px solid var(--border)'
                  }}
                />
              </div>

              <button
                className="button button-primary"
                onClick={handleExecuteTool}
                disabled={executing}
                style={{ width: '100%' }}
              >
                <Play size={14} /> {executing ? 'Executing tool as agent…' : `Call ${selectedToolName}`}
              </button>
            </div>

            {/* Right: Output */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Structured Agent Response
                </span>
                {execResult && (
                  <span style={{ fontSize: '11px', color: 'var(--success)' }}>
                    ✓ Returned to agent
                  </span>
                )}
              </div>

              <div style={{
                flex: 1,
                background: 'var(--main-bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                maxHeight: '420px'
              }}>
                {executing && (
                  <div style={{ color: 'var(--muted)', padding: '20px', textAlign: 'center' }}>
                    Executing tool in active page context…
                  </div>
                )}
                {execError && (
                  <div style={{ color: 'var(--danger)', padding: '8px' }}>
                    Error: {execError}
                  </div>
                )}
                {execResult && (
                  <pre style={{ margin: 0, color: 'var(--ink)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(execResult, null, 2)}
                  </pre>
                )}
                {!executing && !execError && !execResult && (
                  <div style={{ color: 'var(--muted)', padding: '40px 20px', textAlign: 'center' }}>
                    Click "Call {selectedToolName}" to invoke the tool directly on this page.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Live Agent Log */}
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              Real-time audit log of tool calls invoked on this page:
            </div>

            {logs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--card-bg)', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--muted)' }}>
                No tool calls logged in this session yet. Use the Agent Console or call a tool from your agent.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
                {logs.map(l => (
                  <div
                    key={l.id}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                          {l.toolName}
                        </code>
                        <span style={{ fontSize: '11px', color: l.error ? 'var(--danger)' : 'var(--success)' }}>
                          {l.error ? '❌ Failed' : '✓ Completed'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                          ({l.durationMs}ms)
                        </span>
                      </div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        Args: {JSON.stringify(l.arguments)}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {l.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
