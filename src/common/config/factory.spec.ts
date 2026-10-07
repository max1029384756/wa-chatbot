import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { configFactory } from './factory';
import defaultConfig from '@/config/config.default';

jest.mock('../../config/config.instagram-config-test', () => ({
  default: {
    services: {
      instagram: {
        managedAccounts: { '900000099': 'sample_legacy' },
        accessTokens: { '900000099': 'fictional-expired-token' },
      },
    },
  },
}), { virtual: true });

describe('Instagram environment configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAccounts = process.env.INSTAGRAM_MANAGED_ACCOUNTS;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAccounts === undefined) delete process.env.INSTAGRAM_MANAGED_ACCOUNTS;
    else process.env.INSTAGRAM_MANAGED_ACCOUNTS = originalAccounts;
    jest.restoreAllMocks();
  });

  it('reads env when the factory executes, after the module was imported', async () => {
    process.env.NODE_ENV = 'instagram-config-test-missing';
    process.env.INSTAGRAM_MANAGED_ACCOUNTS = '{"900000001":" SAMPLE_LODGE "}';

    const config = await configFactory();

    expect(config.services.instagram.managedAccounts).toEqual({ '900000001': 'sample_lodge' });
  });

  it.each([undefined, '', '{}', 'not-json', '{"bad-id":"private-config-value"}'])(
    'does not interrupt other configuration or leak invalid env %j', async (raw) => {
      process.env.NODE_ENV = 'instagram-config-test';
      if (raw === undefined) delete process.env.INSTAGRAM_MANAGED_ACCOUNTS;
      else process.env.INSTAGRAM_MANAGED_ACCOUNTS = raw;
      const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

      const config = await configFactory();

      expect(config.services.instagram.managedAccounts).toBeUndefined();
      expect(config.services.instagram.accessTokens).toEqual({ '900000099': 'fictional-expired-token' });
      expect(config.amo.channels.wa).toEqual(defaultConfig.amo.channels.wa);
      expect(config.amo.channels.telegram).toEqual(defaultConfig.amo.channels.telegram);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('INSTAGRAM_MANAGED_ACCOUNTS'));
      expect(JSON.stringify(warning.mock.calls)).not.toContain('private-config-value');
    },
  );
});
