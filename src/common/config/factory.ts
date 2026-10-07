import { merge } from 'lodash';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';
import defaultConfig from '@/config/config.default';
import { Logger } from '@nestjs/common';
import { INSTAGRAM_MANAGED_ACCOUNTS_DIAGNOSTIC, parseInstagramManagedAccounts } from '@/modules/instagram/instagram-managed-accounts';

export const configFactory: ConfigFactory = async () => {
  let config = merge({}, defaultConfig, {
    services: { instagram: { managedAccounts: undefined as Record<string, string> | undefined } },
  });
  try {
    const env = process.env.NODE_ENV || 'development';
    const configuration = await import(`../../config/config.${env}`);

    config = merge(config, configuration.default);
  } catch (err) {
    // Missing environment-specific configuration retains the defaults for other channels.
  }

  // Read at factory execution time, after Nest loads .env. Environment-specific
  // files cannot supply a fallback list when this mandatory variable is invalid.
  const managedAccounts = parseInstagramManagedAccounts(process.env.INSTAGRAM_MANAGED_ACCOUNTS);
  config.services.instagram = { ...config.services.instagram, managedAccounts };
  if (!managedAccounts) new Logger('InstagramConfiguration').warn(INSTAGRAM_MANAGED_ACCOUNTS_DIAGNOSTIC);

  return config;
};
