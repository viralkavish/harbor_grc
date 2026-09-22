import { getModelContext } from './polyfill';
import { api } from '../api';
import type { Navigate, Notify } from '../types';

export const KNOWN_RESOURCE_COLLECTIONS = [
  'controls', 'policies', 'vendors', 'risks', 'evidence',
  'audits', 'audit_requests', 'tasks', 'people', 'assets',
  'access_reviews', 'questionnaires', 'exceptions', 'frameworks'
];

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

  // 3. search_workspace
  mc.registerTool({
    name: 'search_workspace',
    description: 'Execute fast full-text search across all controls, policies, vendors, evidence, risks, and tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword or question' }
      },
      required: ['query']
    },
    annotations: { readOnlyHint: true },
    execute: async (args: { query: string }) => {
      return await api.get(`/search?q=${encodeURIComponent(args.query || '')}`);
    }
  });

  // 4. list_records
  mc.registerTool({
    name: 'list_records',
    description: 'List compliance records from any resource collection (controls, policies, vendors, risks, evidence, audits, tasks, people, assets, access_reviews, questionnaires, exceptions, frameworks).',
    inputSchema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Collection name to list',
          enum: KNOWN_RESOURCE_COLLECTIONS
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

  // 5. get_record
  mc.registerTool({
    name: 'get_record',
    description: 'Retrieve full details for a specific compliance record by resource name and ID.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', enum: KNOWN_RESOURCE_COLLECTIONS },
        id: { type: 'string', description: 'Record ID' }
      },
      required: ['resource', 'id']
    },
    annotations: { readOnlyHint: true },
    execute: async (args: { resource: string; id: string }) => {
      return await api.get(`/${args.resource}/${args.id}`);
    }
  });

  // 6. create_record
  mc.registerTool({
    name: 'create_record',
    description: 'Create a new compliance record in the active workspace database.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'Resource collection name', enum: KNOWN_RESOURCE_COLLECTIONS },
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
        resource: { type: 'string', description: 'Resource collection name', enum: KNOWN_RESOURCE_COLLECTIONS },
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

  // 8. delete_record
  mc.registerTool({
    name: 'delete_record',
    description: 'Safely delete a record by resource name and ID.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'Resource collection name', enum: KNOWN_RESOURCE_COLLECTIONS },
        id: { type: 'string', description: 'Record ID' }
      },
      required: ['resource', 'id']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { resource: string; id: string }) => {
      return await api.delete(`/${args.resource}/${args.id}`);
    }
  });

  // 9. run_continuous_checks
  mc.registerTool({
    name: 'run_continuous_checks',
    description: 'Executes automated continuous compliance tests and host posture checks, updating finding counts and test meter.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false },
    execute: async () => {
      return await api.post('/monitoring/run');
    }
  });

  // 10. get_framework_harmonization
  mc.registerTool({
    name: 'get_framework_harmonization',
    description: 'Calculates cross-framework compliance coverage and direct cross-walk requirement mappings across SOC 2, ISO 27001, NIST CSF, HIPAA, and GDPR.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      return await api.get('/frameworks/harmonization');
    }
  });

  // 11. get_roadmap
  mc.registerTool({
    name: 'get_roadmap',
    description: 'Retrieve the 6-phase startup SOC 2 roadmap, milestones, and observation window settings.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      return await api.get('/roadmap');
    }
  });

  // 12. update_roadmap_task
  mc.registerTool({
    name: 'update_roadmap_task',
    description: 'Update completion state of a specific SOC 2 roadmap task.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'Roadmap task ID' },
        completed: { type: 'boolean', description: 'Completion state' }
      },
      required: ['task_id', 'completed']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { task_id: string; completed: boolean }) => {
      return await api.patch(`/roadmap/tasks/${args.task_id}`, { completed: args.completed });
    }
  });

  // 13. verify_live_readiness
  mc.registerTool({
    name: 'verify_live_readiness',
    description: 'Executes automated live database trajectory audit across policies, tests, asset encryption, and vendor DPAs.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false },
    execute: async () => {
      return await api.post('/roadmap/verify_live');
    }
  });

  // 14. get_soc2_readiness
  mc.registerTool({
    name: 'get_soc2_readiness',
    description: 'Retrieve SOC 2 Type 1 and Type 2 gap analysis, PBC checklist, and CUECs.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const [gap, pbc, cuecs] = await Promise.all([
        api.get('/soc2/gap_analysis'),
        api.get('/soc2/pbc_list'),
        api.get('/soc2/cuecs_and_csocs')
      ]);
      return { gap_analysis: gap, pbc_list: pbc, cuecs_and_csocs: cuecs };
    }
  });

  // 15. generate_audit_sample
  mc.registerTool({
    name: 'generate_audit_sample',
    description: 'Generates randomized population sample for auditor testing (new hires, change management PRs, access reviews).',
    inputSchema: {
      type: 'object',
      properties: {
        population: { type: 'string', enum: ['new_hires', 'pull_requests', 'access_reviews', 'vendor_evaluations'] },
        sample_size: { type: 'number', description: 'Sample size' }
      },
      required: ['population']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { population: string; sample_size?: number }) => {
      return await api.post('/soc2/sample_generator', args);
    }
  });

  // 16. get_auditor_hub
  mc.registerTool({
    name: 'get_auditor_hub',
    description: 'Retrieve all 21 pre-staged AICPA Provided By Client (PBC) audit deliverables and review statuses.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      return await api.get('/auditor_hub');
    }
  });

  // 17. update_pbc_status
  mc.registerTool({
    name: 'update_pbc_status',
    description: 'Update auditor status (accepted, in_review, needs_clarification) and notes on an auditor PBC item.',
    inputSchema: {
      type: 'object',
      properties: {
        pbc_id: { type: 'string', description: 'PBC item ID' },
        status: { type: 'string', enum: ['accepted', 'in_review', 'needs_clarification'] },
        notes: { type: 'string', description: 'Reviewer notes' }
      },
      required: ['pbc_id', 'status']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { pbc_id: string; status: string; notes?: string }) => {
      return await api.patch(`/auditor_hub/items/${args.pbc_id}`, {
        status: args.status,
        ...(args.notes ? { notes: args.notes } : {})
      });
    }
  });

  // 18. evaluate_policy_jev
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

  // 19. link_compatible_controls
  mc.registerTool({
    name: 'link_compatible_controls',
    description: 'Link verified compatible controls to a policy document.',
    inputSchema: {
      type: 'object',
      properties: {
        policy_id: { type: 'string', description: 'Policy ID' },
        control_ids: { type: 'array', items: { type: 'string' } }
      },
      required: ['policy_id', 'control_ids']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { policy_id: string; control_ids: string[] }) => {
      return await api.post(`/jev/policies/${args.policy_id}/link_compatible`, {
        control_ids: args.control_ids
      });
    }
  });

  // 20. get_policy_versions
  mc.registerTool({
    name: 'get_policy_versions',
    description: 'Retrieve immutable historical version snapshots for a policy.',
    inputSchema: {
      type: 'object',
      properties: {
        policy_id: { type: 'string', description: 'Policy ID' }
      },
      required: ['policy_id']
    },
    annotations: { readOnlyHint: true },
    execute: async (args: { policy_id: string }) => {
      return await api.get(`/policies/${args.policy_id}/versions`);
    }
  });

  // 21. auto_populate_system_description
  mc.registerTool({
    name: 'auto_populate_system_description',
    description: 'Auto-populates AICPA SOC 2 Section 3 System Description with active infrastructure components and third-party vendors.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false },
    execute: async () => {
      return await api.post('/system_description/auto_populate');
    }
  });

  // 22. update_system_description
  mc.registerTool({
    name: 'update_system_description',
    description: 'Update narrative sections in AICPA SOC 2 Section 3 System Description.',
    inputSchema: {
      type: 'object',
      properties: {
        sections: { type: 'array', items: { type: 'object' }, description: 'Sections array' }
      },
      required: ['sections']
    },
    annotations: { readOnlyHint: false },
    execute: async (args: { sections: any[] }) => {
      return await api.patch('/system_description', { sections: args.sections });
    }
  });

  // 23. analyze_vendor_soc2
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

  // 24. auto_fill_questionnaire
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
