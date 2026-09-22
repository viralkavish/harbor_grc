import { getModelContext } from './polyfill';
import { api } from '../api';
import type { Navigate, Notify } from '../types';

export function registerHarborWebMcpTools(handlers: { onNavigate: Navigate; notify?: Notify }) {
  const mc = getModelContext();

  // 1. navigate_view
  mc.registerTool({
    name: 'navigate_view',
    description: 'Directly steers the active Harbor GRC user interface to any of the 23 views (e.g. overview, roadmap, soc2_readiness, tests, monitoring, frameworks, controls, evidence, policies, system_description, vendors, risks, audits, tasks, people, assets, access_reviews, questionnaires, exceptions, trust, integrations, activity, settings).',
    inputSchema: {
      type: 'object',
      properties: {
        view: {
          type: 'string',
          description: 'Target view ID to navigate to',
          enum: [
            'overview', 'roadmap', 'soc2_readiness', 'tests', 'monitoring',
            'frameworks', 'controls', 'evidence', 'policies', 'system_description',
            'vendors', 'risks', 'audits', 'tasks', 'people', 'assets',
            'access_reviews', 'questionnaires', 'exceptions', 'trust',
            'integrations', 'activity', 'settings'
          ]
        },
        record_id: {
          type: 'string',
          description: 'Optional ID of a specific record to view or edit'
        }
      },
      required: ['view']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { view: string; record_id?: string }) => {
      handlers.onNavigate(args.view, args.record_id);
      if (handlers.notify) {
        handlers.notify(`WebMCP Agent navigated to #${args.view}${args.record_id ? '/' + args.record_id : ''}`);
      }
      return {
        action: 'navigate',
        view: args.view,
        record_id: args.record_id,
        current_hash: window.location.hash,
        status: 'navigated'
      };
    }
  });

  // 2. get_workspace_overview
  mc.registerTool({
    name: 'get_workspace_overview',
    description: 'Retrieve real-time workspace compliance readiness metrics, open risk counts, overdue tasks, expiring evidence, and prioritized attention items.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      return await api.get('/dashboard');
    }
  });

  // 3. get_framework_harmonization
  mc.registerTool({
    name: 'get_framework_harmonization',
    description: 'Calculates cross-framework compliance coverage and direct cross-walk requirement mappings across SOC 2, ISO 27001, NIST CSF, HIPAA, and GDPR.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      return await api.get('/frameworks/harmonization');
    }
  });

  // 4. run_continuous_checks
  mc.registerTool({
    name: 'run_continuous_checks',
    description: 'Executes automated continuous compliance tests and host posture checks, updating finding counts and test meter.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false },
    execute: async () => {
      return await api.post('/monitoring/run');
    }
  });

  // 5. list_records
  mc.registerTool({
    name: 'list_records',
    description: 'List compliance records from any resource collection (controls, policies, vendors, risks, evidence, audits, tasks, people, assets, access_reviews, questionnaires, exceptions, frameworks).',
    inputSchema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Collection name to list',
          enum: [
            'controls', 'policies', 'vendors', 'risks', 'evidence',
            'audits', 'tasks', 'people', 'assets', 'access_reviews',
            'questionnaires', 'exceptions', 'frameworks'
          ]
        },
        q: { type: 'string', description: 'Search keyword' },
        status: { type: 'string', description: 'Filter by status' }
      },
      required: ['resource']
    },
    annotations: { readOnlyHint: true },
    execute: async (args: { resource: string; q?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (args.q) params.set('q', args.q);
      if (args.status) params.set('status', args.status);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return await api.get(`/${args.resource}${queryStr}`);
    }
  });

  // 6. create_record
  mc.registerTool({
    name: 'create_record',
    description: 'Create a new compliance record in the active workspace database.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'Resource collection name' },
        payload: { type: 'object', description: 'Fields matching resource schema' }
      },
      required: ['resource', 'payload']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { resource: string; payload: any }) => {
      return await api.post(`/${args.resource}`, args.payload);
    }
  });

  // 7. update_record
  mc.registerTool({
    name: 'update_record',
    description: 'Update fields on an existing compliance record by resource name and ID.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'Resource collection name' },
        id: { type: 'string', description: 'Record ID' },
        payload: { type: 'object', description: 'Fields to update' }
      },
      required: ['resource', 'id', 'payload']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { resource: string; id: string; payload: any }) => {
      return await api.patch(`/${args.resource}/${args.id}`, args.payload);
    }
  });

  // 8. evaluate_policy_jev
  mc.registerTool({
    name: 'evaluate_policy_jev',
    description: 'Executes live TypeSafe JEV System One evaluation on natural language policy text against compliance controls.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Policy title' },
        content: { type: 'string', description: 'Policy markdown/text content' }
      },
      required: ['content']
    },
    annotations: { readOnlyHint: true },
    execute: async (args: { title?: string; content: string }) => {
      return await api.post('/jev/evaluate', {
        title: args.title || 'Evaluated Policy',
        content: args.content
      });
    }
  });

  // 9. auto_populate_system_description
  mc.registerTool({
    name: 'auto_populate_system_description',
    description: 'Auto-populates AICPA SOC 2 Section 3 System Description with active infrastructure components and third-party vendors.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false },
    execute: async () => {
      return await api.post('/system_description/auto_populate');
    }
  });

  // 10. analyze_vendor_soc2
  mc.registerTool({
    name: 'analyze_vendor_soc2',
    description: 'Analyzes a third-party vendor SOC 2 examination report, verifies unqualified opinion, and extracts mandatory CUECs.',
    inputSchema: {
      type: 'object',
      properties: {
        vendor_id: { type: 'string', description: 'Optional vendor record ID' },
        vendor_name: { type: 'string', description: 'Vendor title or organization name' },
        report_summary: { type: 'string', description: 'Optional report text summary' }
      },
      required: ['vendor_name']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { vendor_id?: string; vendor_name: string; report_summary?: string }) => {
      return await api.post('/vendors/analyze_soc2', args);
    }
  });

  // 11. auto_fill_questionnaire
  mc.registerTool({
    name: 'auto_fill_questionnaire',
    description: 'Drafts answers to security questionnaire prompts grounded strictly in published organizational policies with section citations.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prospect or auditor security question' }
      },
      required: ['prompt']
    },
    annotations: { readOnlyHint: true },
    execute: async (args: { prompt: string }) => {
      return await api.post('/questionnaires/auto_fill', { prompt: args.prompt });
    }
  });
}
