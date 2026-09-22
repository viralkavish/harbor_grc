export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    [key: string]: any;
  };
  execute: (args: any, client?: any) => Promise<any> | any;
}

export interface WebMcpContext {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void;
  unregisterTool: (name: string) => void;
  getTools: () => Promise<WebMcpTool[]>;
  executeTool: (toolOrName: string | WebMcpTool, args: any) => Promise<any>;
  provideContext: (options: { tools: WebMcpTool[] }) => void;
  isEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  addEventListener?: (type: string, listener: (ev: any) => void) => void;
  removeEventListener?: (type: string, listener: (ev: any) => void) => void;
}

export interface WebMcpToolCallLog {
  id: string;
  toolName: string;
  timestamp: string;
  arguments: any;
  result?: any;
  error?: string;
  durationMs: number;
}
