export const APP_VERSION = '0.2.0';
export const RELEASE_DATE = '2026-09-21';

export interface ChangelogEntry {
  version: string;
  date: string;
  badge: string;
  title: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.2.0',
    date: '2026-09-21',
    badge: 'Latest',
    title: 'JEV Semantic Engine, Astra Cosmic Redesign & Security Hardening',
    highlights: [
      'JEV Policy-to-Control Matcher: Instant semantic judgment for policy uploads with clause extraction and gap analysis across 24 compliance controls (SOC 2, ISO 27001, HIPAA, NIST CSF).',
      'JEV API Key Configuration: Dedicated Settings panel to configure, test, and validate TypeSafe JEV System One API keys with live latency benchmarking.',
      'Astra Cosmic Interface: Refined deep obsidian palette (#090d16), glassmorphic elevation, and removal of intrusive informational banner boxes across all views.',
      'Discreet Gateway on Cloudflare Workers: Zero information disclosure on unauthenticated landing routes, single consolidated Google SSO container, and sanitized health endpoints.',
      'In-App Version Indicator & Changelog: Direct visibility into system build, active version badge, and interactive release history modal.',
      'API Reliability Enhancements: Unified /api/settings, /api/workspace, and /api/monitoring/checks aliases with 100% test coverage.'
    ]
  },
  {
    version: '0.1.0',
    date: '2026-09-20',
    badge: 'Initial Release',
    title: 'Harbor GRC Initial Release',
    highlights: [
      'Comprehensive SOC 2 Type 1 & 2 readiness dashboard, gap analysis, and auditor PBC checklist generator.',
      'Section 3 System Description auto-population with AICPA DC 2018 mapping.',
      'Continuous controls testing with 8 automated checks and real-time posture scoring.',
      'Public Trust Center with custom domains, NDA gated access requests, and compliance badges.',
      'Full portable SQLite backup/restore engine with formula injection defense.'
    ]
  }
];
