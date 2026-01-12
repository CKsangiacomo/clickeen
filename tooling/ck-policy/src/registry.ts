import { getEntitlementsMatrix } from './matrix';

const matrix = getEntitlementsMatrix();

export const ENTITLEMENT_KEYS = Object.keys(matrix.capabilities);
export const FLAG_KEYS = ENTITLEMENT_KEYS.filter((key) => matrix.capabilities[key]?.kind === 'flag');
export const CAP_KEYS = ENTITLEMENT_KEYS.filter((key) => matrix.capabilities[key]?.kind === 'cap');
export const BUDGET_KEYS = ENTITLEMENT_KEYS.filter((key) => matrix.capabilities[key]?.kind === 'budget');

export type FlagKey = string;
export type CapKey = string;
export type BudgetKey = string;

export const ACTION_KEYS = [
  'instance.create',
  'instance.publish',
  'context.websiteUrl.set',
  'platform.upload',
] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];
