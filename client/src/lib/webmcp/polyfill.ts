import type { WebMcpTool, WebMcpContext } from './types';

class BrowserModelContext implements WebMcpContext {
  private toolMap: Map<string, WebMcpTool> = new Map();
  private listeners: Map<string, Set<(ev: any) => void>> = new Map();

  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): void {
    if (!tool || !tool.name) {
      throw new Error('WebMCP tool must provide a valid name');
    }
    this.toolMap.set(tool.name, tool);
    this.dispatchEvent('webmcp:tool-registered', { name: tool.name, tool });

    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        this.unregisterTool(tool.name);
      }, { once: true });
    }
  }

  unregisterTool(name: string): void {
    if (this.toolMap.has(name)) {
      this.toolMap.delete(name);
      this.dispatchEvent('webmcp:tool-unregistered', { name });
    }
  }

  async getTools(): Promise<WebMcpTool[]> {
    return Array.from(this.toolMap.values());
  }

  async executeTool(toolOrName: string | WebMcpTool, args: any): Promise<any> {
    const name = typeof toolOrName === 'string' ? toolOrName : toolOrName.name;
    const tool = this.toolMap.get(name);
    if (!tool) {
      throw new Error(`WebMCP Tool '${name}' is not registered`);
    }

    const t0 = performance.now();
    this.dispatchEvent('webmcp:tool-calling', { name, arguments: args });

    try {
      const result = await tool.execute(args || {});
      const durationMs = Math.round(performance.now() - t0);
      this.dispatchEvent('webmcp:tool-executed', {
        name,
        arguments: args,
        result,
        durationMs,
        success: true
      });
      return result;
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - t0);
      this.dispatchEvent('webmcp:tool-executed', {
        name,
        arguments: args,
        error: err.message,
        durationMs,
        success: false
      });
      throw err;
    }
  }

  provideContext(options: { tools: WebMcpTool[] }): void {
    if (options?.tools && Array.isArray(options.tools)) {
      for (const t of options.tools) {
        this.registerTool(t);
      }
    }
  }

  addEventListener(type: string, listener: (ev: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (ev: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatchEvent(type: string, detail: any): void {
    const set = this.listeners.get(type);
    if (set) {
      set.forEach(cb => {
        try { cb({ type, detail }); } catch (e) { /* ignore */ }
      });
    }

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        window.dispatchEvent(new CustomEvent(type, { detail }));
      } catch (e) { /* ignore */ }
    }
  }
}

let activeContext: BrowserModelContext | null = null;

export function initWebMcpPolyfill(): WebMcpContext {
  if (!activeContext) {
    activeContext = new BrowserModelContext();
  }

  if (typeof window !== 'undefined') {
    (window as any).modelContext = activeContext;
    (window as any).__webmcp = activeContext;
    if (typeof document !== 'undefined') {
      (document as any).modelContext = activeContext;
    }
    if (typeof navigator !== 'undefined' && !(navigator as any).modelContext) {
      (navigator as any).modelContext = activeContext;
    }
  }

  return activeContext;
}

export function getModelContext(): WebMcpContext {
  if (!activeContext) {
    return initWebMcpPolyfill();
  }
  return activeContext;
}
