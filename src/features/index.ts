import type { FeatureDefinition } from '../core/feature';
import { attachmentsFeature } from './attachments';
import { noteRoamingFeature } from './note-roaming';
import { slidesFeature } from './slides';

export const FEATURES: readonly FeatureDefinition[] = [
  attachmentsFeature as unknown as FeatureDefinition,
  noteRoamingFeature as unknown as FeatureDefinition,
  slidesFeature as unknown as FeatureDefinition,
];
