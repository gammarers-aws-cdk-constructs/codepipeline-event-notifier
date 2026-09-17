/**
 * Tag filter used to decide whether a CodePipeline should be notified.
 */
export interface PipelineTagFilter {
  /**
   * Tag key that must be present on the pipeline.
   */
  readonly key: string;

  /**
   * Accepted values for {@link key}. Matching is OR within this list.
   */
  readonly values: readonly string[];
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Returns whether `value` is a non-empty list of `{ key, values }` tag filters.
 *
 * @param value unknown JSON value
 * @returns true when the value can be used as tag filters
 */
export const isPipelineTagFilterList = (value: unknown): value is PipelineTagFilter[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  for (const item of value) {
    if (!isPipelineTagFilter(item)) {
      return false;
    }
  }

  return true;
};

/**
 * Returns whether `value` is a single tag filter with a non-empty key and values.
 *
 * @param value unknown JSON value
 * @returns true when the value is a tag filter
 */
export const isPipelineTagFilter = (value: unknown): value is PipelineTagFilter => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('key' in value) || !('values' in value)) {
    return false;
  }
  if (!isNonEmptyString(value.key)) {
    return false;
  }
  if (!Array.isArray(value.values) || value.values.length === 0) {
    return false;
  }

  for (const tagValue of value.values) {
    if (!isNonEmptyString(tagValue)) {
      return false;
    }
  }

  return true;
};

/**
 * Parses `TARGET_PIPELINE_TAGS` JSON into tag filters.
 *
 * @param raw JSON string from the environment
 * @returns normalized tag filters
 * @throws when the JSON is invalid or not a tag-filter list
 */
export const parseTargetPipelineTags = (raw: string): PipelineTagFilter[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('TARGET_PIPELINE_TAGS must be valid JSON');
  }

  if (!isPipelineTagFilterList(parsed)) {
    throw new Error('TARGET_PIPELINE_TAGS must be a non-empty array of { key, values }');
  }

  return normalizeTagFilters(parsed);
};

/**
 * Trims keys/values and rejects duplicate keys.
 *
 * @param filters tag filters to normalize
 * @returns normalized filters
 * @throws when a key is duplicated
 */
export const normalizeTagFilters = (filters: readonly PipelineTagFilter[]): PipelineTagFilter[] => {
  const seenKeys = new Set<string>();
  const normalized: PipelineTagFilter[] = [];

  for (const filter of filters) {
    const key = filter.key.trim();
    if (seenKeys.has(key)) {
      throw new Error(`Tag filter list contains duplicate key: ${key}`);
    }
    seenKeys.add(key);

    normalized.push({
      key,
      values: filter.values.map((value) => value.trim()),
    });
  }

  return normalized;
};

/**
 * Converts CodePipeline tag entries into a key/value map.
 *
 * @param tags tags returned by ListTagsForResource
 * @returns map of tag key to tag value
 */
export const toPipelineTagMap = (
  tags: readonly { readonly key?: string; readonly value?: string }[] | undefined,
): { readonly [key: string]: string } => {
  const mapped: { [key: string]: string } = {};
  if (!tags) {
    return mapped;
  }

  for (const tag of tags) {
    if (!tag.key || tag.value === undefined) {
      continue;
    }
    mapped[tag.key] = tag.value;
  }

  return mapped;
};

/**
 * Returns whether pipeline tags satisfy every filter.
 * Keys are AND; values within a filter are OR.
 *
 * @param pipelineTags tags currently on the pipeline
 * @param filters required tag filters
 * @returns true when the pipeline matches all filters
 */
export const matchesTargetPipelineTags = (
  pipelineTags: Readonly<{ [key: string]: string }>,
  filters: readonly PipelineTagFilter[],
): boolean => {
  for (const filter of filters) {
    const actual = pipelineTags[filter.key];
    if (actual === undefined) {
      return false;
    }
    if (!filter.values.includes(actual)) {
      return false;
    }
  }

  return true;
};

/**
 * Resolves a CodePipeline ARN for ListTagsForResource.
 *
 * @param resources EventBridge `resources` array
 * @param region event region
 * @param account event account
 * @param pipelineName pipeline name from the event detail
 * @returns ARN when it can be resolved
 */
export const resolvePipelineArn = (
  resources: readonly string[] | undefined,
  region: string | undefined,
  account: string | undefined,
  pipelineName: string,
): string | undefined => {
  const fromResources = resources?.[0];
  if (fromResources) {
    return fromResources;
  }
  if (!region || !account) {
    return undefined;
  }

  return `arn:aws:codepipeline:${region}:${account}:${pipelineName}`;
};

/**
 * Returns whether `value` is a non-empty list of non-empty strings.
 *
 * @param value unknown JSON value
 * @returns true when the value is a string list
 */
export const isNonEmptyStringList = (value: unknown): value is string[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  for (const item of value) {
    if (!isNonEmptyString(item)) {
      return false;
    }
  }

  return true;
};

/**
 * Parses optional `TARGET_PIPELINE_ARNS` JSON into an ARN allowlist.
 *
 * @param raw JSON string from the environment, or undefined when unset
 * @returns normalized ARNs, or undefined when the allowlist is not configured
 * @throws when the JSON is invalid or not a string list
 */
export const parseAllowedPipelineArns = (raw: string | undefined): string[] | undefined => {
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('TARGET_PIPELINE_ARNS must be valid JSON');
  }

  if (!isNonEmptyStringList(parsed)) {
    throw new Error('TARGET_PIPELINE_ARNS must be a non-empty array of strings');
  }

  return parsed.map((arn) => arn.trim());
};

/**
 * Returns whether a pipeline ARN is allowed when an allowlist is configured.
 *
 * @param pipelineArn resolved pipeline ARN
 * @param allowedArns optional allowlist
 * @returns true when no allowlist is set, or the ARN is listed
 */
export const isAllowedPipelineArn = (
  pipelineArn: string,
  allowedArns: readonly string[] | undefined,
): boolean => {
  if (!allowedArns) {
    return true;
  }

  return allowedArns.includes(pipelineArn);
};

