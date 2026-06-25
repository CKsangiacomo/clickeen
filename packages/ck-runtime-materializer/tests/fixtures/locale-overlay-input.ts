import { baseCompiledWidget, baseState } from './base-input';
import type { RuntimeMaterializerInput } from '../../src/types';

export const frOverlayValues = {
  headline: 'Clickeen aide les equipes a lancer vite.',
  'nested.eyebrow': 'Widgets natifs IA',
  'items.0.title': 'Premiere reponse',
  'items.1.title': 'Deuxieme reponse',
};

export const frMaterializerInput = {
  compiled: baseCompiledWidget,
  artifactCoordinate: {
    kind: 'account-instance-widget',
    accountPublicId: 'CLICKEEN',
    instanceId: 'inst_contract',
    baseLocale: 'en',
    requestedLocale: 'fr',
  },
  displayName: 'Contract Widget',
  state: baseState,
  localeOverlay: {
    locale: 'fr',
    keyKind: 'current_saved_content_concrete_path',
    values: frOverlayValues,
  },
  evidence: {
    schemaWidgetContractFingerprint: 'schema:fingerprint',
    sourceFingerprint: 'source:fingerprint',
    sourceReference: 'accounts/CLICKEEN/instances/inst_contract/source.json',
    overlayFingerprint: 'overlay:fingerprint',
  },
} satisfies RuntimeMaterializerInput;
