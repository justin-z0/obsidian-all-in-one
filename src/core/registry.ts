import { isControlSetting } from './feature';
import type { FeatureDefinition } from './feature';
import { isRecord } from './utils';

const FEATURE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const OPTION_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const RESERVED_FEATURE_IDS = new Set(['global']);
const RESERVED_OPTION_KEYS = new Set(['$enabled']);

export interface FeatureValidationResult {
  valid: FeatureDefinition[];
  errors: string[];
}

export function validateFeatures(
  features: readonly FeatureDefinition[],
): FeatureValidationResult {
  const valid: FeatureDefinition[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const featureErrors = validateFeature(feature, seen);
    if (featureErrors.length > 0) {
      errors.push(...featureErrors);
      continue;
    }

    seen.add(feature.id);
    valid.push(feature);
  }

  return { valid, errors };
}

function validateFeature(
  feature: FeatureDefinition,
  seen: ReadonlySet<string>,
): string[] {
  const errors: string[] = [];
  const label = feature.id || '<missing id>';

  if (!FEATURE_ID_PATTERN.test(feature.id)) {
    errors.push(`Invalid feature id: ${label}`);
  } else if (feature.id.length > 48) {
    errors.push(`Feature id is too long: ${label}`);
  } else if (RESERVED_FEATURE_IDS.has(feature.id)) {
    errors.push(`Reserved feature id: ${label}`);
  } else if (seen.has(feature.id)) {
    errors.push(`Duplicate feature id: ${label}`);
  }

  if (typeof feature.name !== 'string' || feature.name.trim() === '') {
    errors.push(`Feature ${label} has an empty name`);
  }

  if (
    typeof feature.description !== 'string' ||
    feature.description.trim() === ''
  ) {
    errors.push(`Feature ${label} has an empty description`);
  }

  if (typeof feature.defaultEnabled !== 'boolean') {
    errors.push(`Feature ${label} defaultEnabled must be a boolean`);
  }

  if (!isRecord(feature.defaultOptions)) {
    errors.push(`Feature ${label} defaultOptions must be an object`);
    return errors;
  }

  if (typeof feature.setup !== 'function') {
    errors.push(`Feature ${label} is missing setup()`);
  }

  const optionKeys = new Set<string>();
  for (const setting of feature.settings ?? []) {
    if (!isControlSetting(setting)) {
      continue;
    }

    const key = setting.control.key;
    if (typeof key !== 'string' || !OPTION_KEY_PATTERN.test(key)) {
      errors.push(`Feature ${label} has an invalid option key: ${String(key)}`);
      continue;
    }

    if (RESERVED_OPTION_KEYS.has(key) || key.includes('.')) {
      errors.push(`Feature ${label} uses a reserved option key: ${key}`);
    }

    if (optionKeys.has(key)) {
      errors.push(`Feature ${label} has a duplicate option key: ${key}`);
    }
    optionKeys.add(key);

    if (!(key in feature.defaultOptions)) {
      errors.push(`Feature ${label} is missing a default for option: ${key}`);
    }
  }

  return errors;
}
