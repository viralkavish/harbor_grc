import {
  AlertTriangle, Award, Briefcase, Building2, CheckSquare, Compass, FileCheck,
  FileText, Globe, HardDrive, HelpCircle, History, Layers, LayoutDashboard,
  Plug, Radio, ScrollText, Settings, Shield, ShieldAlert, ShieldCheck, UserCheck, Users,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_SECTIONS: {title: string; items: NavigationItem[]}[] = [
  {
    title: 'Workspace',
    items: [
      {id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Your workspace at a glance'},
      {id: 'roadmap', label: 'SOC 2 roadmap', icon: Compass, description: 'Plan your next compliance milestones'},
      {id: 'tasks', label: 'Tasks', icon: CheckSquare, description: 'Track assignments, owners and due dates'},
    ],
  },
  {
    title: 'Compliance',
    items: [
      {id: 'soc2_readiness', label: 'Readiness', icon: Award, description: 'Assess SOC 2 readiness and remaining gaps'},
      {id: 'frameworks', label: 'Frameworks', icon: Layers, description: 'Browse compliance standards and requirements'},
      {id: 'controls', label: 'Controls', icon: Shield, description: 'Manage safeguards and control coverage'},
      {id: 'policies', label: 'Policies', icon: FileText, description: 'Write, review and approve company policies'},
      {id: 'evidence', label: 'Evidence', icon: FileCheck, description: 'Collect proof for controls and audits'},
      {id: 'system_description', label: 'System description', icon: ScrollText, description: 'Describe your systems, scope and services'},
    ],
  },
  {
    title: 'Security',
    items: [
      {id: 'tests', label: 'Continuous tests', icon: ShieldCheck, description: 'Run automated security and compliance checks'},
      {id: 'monitoring', label: 'Monitoring', icon: Radio, description: 'Review ongoing monitoring checks and findings'},
      {id: 'risks', label: 'Risks', icon: AlertTriangle, description: 'Assess threats and track mitigation plans'},
      {id: 'exceptions', label: 'Exceptions', icon: ShieldAlert, description: 'Review approved deviations and expiry dates'},
    ],
  },
  {
    title: 'Organization',
    items: [
      {id: 'people', label: 'People', icon: Users, description: 'Manage personnel and responsibilities'},
      {id: 'assets', label: 'Assets', icon: HardDrive, description: 'Maintain your hardware and software inventory'},
      {id: 'vendors', label: 'Vendors', icon: Building2, description: 'Review third-party suppliers and their security'},
      {id: 'access_reviews', label: 'Access reviews', icon: UserCheck, description: 'Review user access and permissions'},
    ],
  },
  {
    title: 'Share & manage',
    items: [
      {id: 'audits', label: 'Audits', icon: Briefcase, description: 'Coordinate audit requests and engagements'},
      {id: 'questionnaires', label: 'Questionnaires', icon: HelpCircle, description: 'Respond to customer security assessments'},
      {id: 'trust', label: 'Trust center', icon: Globe, description: 'Share your security posture and documents'},
      {id: 'integrations', label: 'Integrations', icon: Plug, description: 'Connect services and data sources'},
      {id: 'activity', label: 'Activity', icon: History, description: 'Review the workspace activity log'},
      {id: 'settings', label: 'Settings', icon: Settings, description: 'Configure your workspace and preferences'},
    ],
  },
];
export const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);
