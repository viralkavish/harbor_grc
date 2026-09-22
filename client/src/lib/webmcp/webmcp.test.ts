import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initWebMcpPolyfill, getModelContext } from './polyfill';
import { registerHarborWebMcpTools } from './harborWebMcp';

describe('WebMCP Polyfill & Tool Registration', () => {
  beforeEach(() => {
    initWebMcpPolyfill();
  });

  it('installs document.modelContext and window.modelContext with standard methods', () => {
    const mc = getModelContext();
    expect(mc).toBeDefined();
    expect(typeof mc.registerTool).toBe('function');
    expect(typeof mc.getTools).toBe('function');
    expect(typeof mc.executeTool).toBe('function');
  });

  it('registers and executes custom tools cleanly', async () => {
    const mc = getModelContext();
    const testTool = {
      name: 'test_add',
      description: 'Adds two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      },
      execute: async (args: { a: number; b: number }) => {
        return { sum: args.a + args.b };
      }
    };

    mc.registerTool(testTool);
    const tools = await mc.getTools();
    expect(tools.some(t => t.name === 'test_add')).toBe(true);

    const result = await mc.executeTool('test_add', { a: 15, b: 27 });
    expect(result).toEqual({ sum: 42 });
  });

  it('registers full Harbor GRC suite and controls navigation', async () => {
    const navigateMock = vi.fn();
    const notifyMock = vi.fn();

    registerHarborWebMcpTools({ onNavigate: navigateMock, notify: notifyMock });
    const mc = getModelContext();
    const tools = await mc.getTools();

    expect(tools.length).toBeGreaterThanOrEqual(10);
    expect(tools.some(t => t.name === 'navigate_view')).toBe(true);
    expect(tools.some(t => t.name === 'get_workspace_overview')).toBe(true);

    // Test navigate_view actuation
    const navResult = await mc.executeTool('navigate_view', { view: 'frameworks' });
    expect(navResult.action).toBe('navigate');
    expect(navResult.view).toBe('frameworks');
    expect(navigateMock).toHaveBeenCalledWith('frameworks', undefined);
  });
});
