import type { Domain, Environment, Priority, Status } from '../shared/finding.js';
import type { Tone } from './Badge.js';

// One place for how each value is coloured, shared by the table pills and the filter dropdowns.

export const PRIORITY_TONE: Record<Priority, Tone> = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4' };

export const STATUS_TONE: Record<Status, Tone> = {
  open: 'neutral',
  in_progress: 'accent',
  risk_accepted: 'warn',
  resolved: 'ok',
};

export const ENVIRONMENT_TONE: Record<Environment, Tone> = {
  production: 'danger',
  staging: 'warn',
  corporate: 'accent',
};

export const DOMAIN_TONE: Record<Domain, Tone> = {
  payments: 'c1',
  identity: 'c2',
  customer_apps: 'c3',
  data_platform: 'c4',
  corporate_it: 'c6',
  devops: 'c5',
};
