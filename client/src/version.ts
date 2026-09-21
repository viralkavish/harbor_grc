export const APP_VERSION = '0.5.0';
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
    version: '0.5.0',
    date: '2026-09-21',
    badge: 'Latest',
    title: "Live TypeSafe JEV System One Integration & Engine Upgrade",
    highlights: [
      "Live TypeSafe Cloud Integration: Connected live TypeSafe JEV System One (jev-1.13.0) API key via https://api.typesafe.ai/v1/systemone.",
      "Frontier Probabilistic Judgments: Augmented policy-to-control compatibility scoring with typed choice and noul primitives with verified confidence scores.",
      "Live Benchmarking & Token Metrics: Integrated live latency benchmarking, token usage tracking, and persistent workspace key management.",
      "Telegram Desktop Omarchy Integration: Installed and configured standalone Telegram Desktop with desktop entry and icon integration."
    ]
  },
  {
    version: '0.4.0',
    date: '2026-09-21',
    badge: 'Stable',
    title: "Top 10 Advanced Vanta & SOC 2 Enterprise Features Suite",
    highlights: [
      "Automated Test Remediation Engine: Copy-pasteable CLI and Terraform fix snippets for failing continuous controls tests.",
      "AI Vendor SOC 2 & CUEC Extractor: Automated examination analysis extracting Complementary User Entity Controls (CUECs) and supply chain risk tiering.",
      "Auditor Autopilot Workspace: Pre-staged 21-item AICPA PBC checklist with in-line review, status toggles, and auditor notes.",
      "Cross-Framework Harmonization Matrix: Multi-framework overlap engine mapping SOC 2 across ISO 27001, NIST CSF 2.0, HIPAA, and GDPR.",
      "Policy-Grounded Security Questionnaire AI Auto-Fill: Instant prospect assessment answering with verified policy citations and 95%+ confidence.",
      "Quarterly User Access Review (UAR) Campaign Engine: Automated certification campaigns with keep/revoke tracking and digital audit hashes.",
      "Vulnerability Management & CVSS Patch SLA Tracker: Real-time countdown timers for Critical (7d), High (30d), and Medium (60d) CVEs.",
      "ISO 42001 & EU AI Act Governance Register: Enterprise AI model catalog tracking Zero Data Retention (ZDR) and risk classifications.",
      "Workforce Compliance Posture: Direct verification of device full-disk encryption and automated training certificate generation.",
      "Real-Time Trust Center Telemetry: Live continuous testing metrics and verified compliance badges for public customer assurance."
    ]
  },
  {
    version: '0.3.0',
    date: '2026-09-21',
    badge: 'Stable',
    title: "Production SOC 2 Roadmap & Live Trajectory Verification Engine",
    highlights: [
      "Automated Live Posture Verification: Evaluates real database evidence against 18 strategic SOC 2 milestones.",
      "Comprehensive 6-Phase Startup Trajectory: Enriched with AICPA Trust Services Criteria, auditor PBC deliverables, and recommended startup tooling.",
      "SOC 2 Type II Observation Window Tracker: Monitors active observation windows (3/6/12 months) and drift-free days.",
      "Audit Roadmap Export: One-click exportable executive audit plan and PBC checklist."
    ]
  },
  {
    version: '0.2.0',
    date: '2026-09-21',
    badge: 'Stable',
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
