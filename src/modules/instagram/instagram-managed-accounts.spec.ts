import { describe, it, expect } from '@jest/globals';
import { parseInstagramManagedAccounts } from './instagram-managed-accounts';

describe('INSTAGRAM_MANAGED_ACCOUNTS parsing', () => {
  it('parses numeric account IDs and normalizes usernames', () => {
    expect(parseInstagramManagedAccounts('{"900000001":" Sample_Lodge ","900000002":"SAMPLE_WAVES"}'))
      .toEqual({ '900000001': 'sample_lodge', '900000002': 'sample_waves' });
  });

  it.each([
    undefined, '', ' ', '{', '{}', 'null', '[]', '123', 'true', '"username"',
    '{"abc":"sample"}', '{"12.3":"sample"}', '{"-123":"sample"}',
    '{"900000001":""}', '{"900000001":"  "}', '{"900000001":123}',
    '{"900000001":null}', '{"900000001":{}}',
    '{"900000001":"sample_lodge","invalid":"sample_waves"}',
  ])('rejects the complete configuration for invalid input %j', (raw) => {
    expect(parseInstagramManagedAccounts(raw)).toBeUndefined();
  });
});
