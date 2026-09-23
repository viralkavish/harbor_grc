import {
  Award, FileCheck, FileText, LayoutDashboard, Settings, Shield, Target, Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_SECTIONS: {title: string; items: NavigationItem[]}[] = [
  {
    title: 'tofromGRC',
    items: [
      {id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Workspace overview and readiness posture'},
      {id: 'soc2_readiness', label: 'SOC 2 Readiness', icon: Award, description: 'Assess SOC 2 Type II readiness and remaining gaps'},
      {id: 'pilot', label: 'Blind Pilot', icon: Target, description: 'Empirically validate JEV model judgment against human ground truth'},
      {id: 'policies', label: 'Policies', icon: FileText, description: 'Company governance policies, review SLAs, and Jev evaluations'},
      {id: 'evidence', label: 'Evidence', icon: FileCheck, description: 'Collect and verify auditor evidence proof'},
      {id: 'frameworks', label: 'Frameworks & Controls', icon: Shield, description: 'Browse compliance standards, controls, and harmonization'},
      {id: 'people', label: 'People', icon: Users, description: 'Workforce personnel, security training, and attestations'},
      {id: 'settings', label: 'Settings', icon: Settings, description: 'Configure workspace scope, Jev API key, and preferences'},
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);
