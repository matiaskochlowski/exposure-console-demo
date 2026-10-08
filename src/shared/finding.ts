import { z } from 'zod';

export const STATUSES = ['open', 'in_progress', 'risk_accepted', 'resolved'] as const;
export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export const ENVIRONMENTS = ['production', 'staging', 'corporate'] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Environment = (typeof ENVIRONMENTS)[number];

export const STATUS_LABEL: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In progress',
  risk_accepted: 'Risk accepted',
  resolved: 'Resolved',
};

/** One exposure finding as shipped in the synthetic dataset. */
export const findingSchema = z.object({
  id: z.string().regex(/^DEMO-\d{4}-\d{5}$/),
  title: z.string(),
  cwe: z.string(),
  cvss: z.number().min(0).max(10),
  epss: z.number().min(0).max(1),
  kev: z.boolean(),
  exploitValidated: z.boolean(),
  assetId: z.string(),
  hostname: z.string(),
  ip: z.string(),
  owner: z.string(),
  environment: z.enum(ENVIRONMENTS),
  assetCriticality: z.number().int().min(1).max(4),
  status: z.enum(STATUSES),
  firstSeen: z.string(),
  scanner: z.string(),
  scannerText: z.string(),
});

export type Finding = z.infer<typeof findingSchema>;
