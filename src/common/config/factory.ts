import { merge } from 'lodash';
import { ConfigFactory } from '@nestjs/config/dist/interfaces/config-factory.interface';
import defaultConfig from '@/config/config.default';

export const configFactory: ConfigFactory = async () => {
  try {
    const env = process.env.NODE_ENV || 'development';
    const configuration = await import(`../../config/config.${env}`);

    return merge(defaultConfig, configuration.default);
  } catch (err) {
    return defaultConfig;
  }
};
