import type { PipelineTagFilter } from '../src/funcs/core/target-pipeline-predicates';
import {
  isAllowedPipelineArn,
  isPipelineTagFilterList,
  matchesTargetPipelineTags,
  normalizeTagFilters,
  parseAllowedPipelineArns,
  parseTargetPipelineTags,
  resolvePipelineArn,
  toPipelineTagMap,
} from '../src/funcs/core/target-pipeline-predicates';

describe('isPipelineTagFilterList', () => {
  it.each([
    { name: 'valid single filter', value: [{ tagKey: 'Notify', tagValues: ['true'] }], expected: true },
    { name: 'empty array', value: [], expected: false },
    { name: 'not an array', value: { tagKey: 'Notify', tagValues: ['true'] }, expected: false },
    { name: 'empty key', value: [{ tagKey: '', tagValues: ['true'] }], expected: false },
    { name: 'empty values', value: [{ tagKey: 'Notify', tagValues: [] }], expected: false },
    { name: 'empty value string', value: [{ tagKey: 'Notify', tagValues: [''] }], expected: false },
    { name: 'non-object entry', value: ['Notify'], expected: false },
    { name: 'null entry', value: [null], expected: false },
    { name: 'missing values', value: [{ tagKey: 'Notify' }], expected: false },
    { name: 'missing key', value: [{ tagValues: ['true'] }], expected: false },
  ])('returns $expected for $name', ({ value, expected }) => {
    expect(isPipelineTagFilterList(value)).toBe(expected);
  });
});

describe('normalizeTagFilters', () => {
  it('copies criteria', () => {
    expect(normalizeTagFilters([
      { tagKey: 'Team', tagValues: ['platform', 'infra'] },
    ])).toEqual([
      { tagKey: 'Team', tagValues: ['platform', 'infra'] },
    ]);
  });

  it('throws on duplicate keys', () => {
    expect(() => normalizeTagFilters([
      { tagKey: 'Notify', tagValues: ['true'] },
      { tagKey: 'Notify', tagValues: ['false'] },
    ])).toThrow('Tag filter list contains duplicate tagKey: Notify');
  });
});

describe('parseTargetPipelineTags', () => {
  it('parses valid JSON filters', () => {
    expect(parseTargetPipelineTags(JSON.stringify([
      { tagKey: 'Notify', tagValues: ['true'] },
    ]))).toEqual([
      { tagKey: 'Notify', tagValues: ['true'] },
    ]);
  });

  it.each([
    { name: 'invalid JSON', raw: '{', message: 'TARGET_PIPELINE_TAGS must be valid JSON' },
    {
      name: 'non-array JSON',
      raw: JSON.stringify({ tagKey: 'Notify', tagValues: ['true'] }),
      message: 'TARGET_PIPELINE_TAGS must be a non-empty array of { tagKey, tagValues }',
    },
    {
      name: 'empty array',
      raw: '[]',
      message: 'TARGET_PIPELINE_TAGS must be a non-empty array of { tagKey, tagValues }',
    },
  ])('throws for $name', ({ raw, message }) => {
    expect(() => parseTargetPipelineTags(raw)).toThrow(message);
  });
});

describe('toPipelineTagMap', () => {
  it.each([
    { name: 'undefined tags', tags: undefined, expected: {} },
    { name: 'empty tags', tags: [], expected: {} },
    {
      name: 'valid tags',
      tags: [{ key: 'Notify', value: 'true' }, { key: 'Team', value: 'platform' }],
      expected: { Notify: 'true', Team: 'platform' },
    },
    {
      name: 'skips missing key or value',
      tags: [{ key: 'Notify' }, { value: 'true' }, { key: 'Team', value: 'platform' }],
      expected: { Team: 'platform' },
    },
  ])('$name', ({ tags, expected }) => {
    expect(toPipelineTagMap(tags)).toEqual(expected);
  });
});

describe('matchesTargetPipelineTags', () => {
  it.each<{
    name: string;
    pipelineTags: { readonly [key: string]: string };
    filters: readonly PipelineTagFilter[];
    expected: boolean;
  }>([
    {
      name: 'single matching value',
      pipelineTags: { Notify: 'true' },
      filters: [{ tagKey: 'Notify', tagValues: ['true'] }],
      expected: true,
    },
    {
      name: 'OR values',
      pipelineTags: { Team: 'infra' },
      filters: [{ tagKey: 'Team', tagValues: ['platform', 'infra'] }],
      expected: true,
    },
    {
      name: 'AND keys',
      pipelineTags: { Notify: 'true', Team: 'platform' },
      filters: [
        { tagKey: 'Notify', tagValues: ['true'] },
        { tagKey: 'Team', tagValues: ['platform'] },
      ],
      expected: true,
    },
    {
      name: 'missing key',
      pipelineTags: { Team: 'platform' },
      filters: [{ tagKey: 'Notify', tagValues: ['true'] }],
      expected: false,
    },
    {
      name: 'value not in list',
      pipelineTags: { Notify: 'false' },
      filters: [{ tagKey: 'Notify', tagValues: ['true'] }],
      expected: false,
    },
    {
      name: 'AND fails when one key mismatches',
      pipelineTags: { Notify: 'true', Team: 'other' },
      filters: [
        { tagKey: 'Notify', tagValues: ['true'] },
        { tagKey: 'Team', tagValues: ['platform'] },
      ],
      expected: false,
    },
  ])('$name', ({ pipelineTags, filters, expected }) => {
    expect(matchesTargetPipelineTags(pipelineTags, filters)).toBe(expected);
  });
});

describe('resolvePipelineArn', () => {
  it.each([
    {
      name: 'prefers EventBridge resources',
      resources: ['arn:aws:codepipeline:us-east-1:123456789012:from-event'],
      region: 'us-west-2',
      account: '999999999999',
      pipelineName: 'my-pipeline',
      expected: 'arn:aws:codepipeline:us-east-1:123456789012:from-event',
    },
    {
      name: 'falls back to constructed ARN',
      resources: [],
      region: 'us-east-1',
      account: '123456789012',
      pipelineName: 'my-pipeline',
      expected: 'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
    },
    {
      name: 'returns undefined without resources or identity',
      resources: [],
      region: undefined,
      account: '123456789012',
      pipelineName: 'my-pipeline',
      expected: undefined,
    },
  ])('$name', ({ resources, region, account, pipelineName, expected }) => {
    expect(resolvePipelineArn(resources, region, account, pipelineName)).toBe(expected);
  });
});

describe('parseAllowedPipelineArns', () => {
  it('returns undefined when the env value is missing or blank', () => {
    expect(parseAllowedPipelineArns(undefined)).toBeUndefined();
    expect(parseAllowedPipelineArns('')).toBeUndefined();
    expect(parseAllowedPipelineArns('   ')).toBeUndefined();
  });

  it('parses and trims ARNs', () => {
    expect(parseAllowedPipelineArns(JSON.stringify([
      ' arn:aws:codepipeline:us-east-1:123456789012:my-pipeline ',
    ]))).toEqual([
      'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
    ]);
  });

  it.each([
    { name: 'invalid JSON', raw: '{', message: 'TARGET_PIPELINE_ARNS must be valid JSON' },
    {
      name: 'non-array JSON',
      raw: JSON.stringify('arn:aws:codepipeline:us-east-1:123456789012:my-pipeline'),
      message: 'TARGET_PIPELINE_ARNS must be a non-empty array of strings',
    },
    {
      name: 'empty array',
      raw: '[]',
      message: 'TARGET_PIPELINE_ARNS must be a non-empty array of strings',
    },
    {
      name: 'empty string entry',
      raw: JSON.stringify(['']),
      message: 'TARGET_PIPELINE_ARNS must be a non-empty array of strings',
    },
  ])('throws for $name', ({ raw, message }) => {
    expect(() => parseAllowedPipelineArns(raw)).toThrow(message);
  });
});

describe('isAllowedPipelineArn', () => {
  it.each([
    {
      name: 'no allowlist',
      pipelineArn: 'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
      allowedArns: undefined,
      expected: true,
    },
    {
      name: 'listed ARN',
      pipelineArn: 'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
      allowedArns: ['arn:aws:codepipeline:us-east-1:123456789012:my-pipeline'],
      expected: true,
    },
    {
      name: 'unlisted ARN',
      pipelineArn: 'arn:aws:codepipeline:us-east-1:123456789012:my-pipeline',
      allowedArns: ['arn:aws:codepipeline:us-east-1:123456789012:other-pipeline'],
      expected: false,
    },
  ])('$name', ({ pipelineArn, allowedArns, expected }) => {
    expect(isAllowedPipelineArn(pipelineArn, allowedArns)).toBe(expected);
  });
});
