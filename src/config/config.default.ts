const env = (key: string): string => process.env[`AMO__${key}`] || '';

export default {
  database: {
    host: env('PG_HOST'),
  },
  node: {
    host: null,
    port: parseInt(String(env('NODE_PORT')), 10) || 4000,
  },
  redisUrl: env('REDIS_URL'),
  lock: {
    retryCount: env('LOCK_RETRY_COUNT') || 35,
    retryDelay: env('LOCK_RETRY_DELAY') || 1000,
    retryJitter: env('LOCK_RETRY_JITTER') || 300
  },
  amo: {
    integration: {
      integrationId: env('INTEGRATION_ID'),
      secretKey: env('INTEGRATION_KEY'),
    },
    chat: {
      channelId: env('CHAT_CHANNEL_ID'),
      secretKey: env('CHAT_CHANNEL_KEY'),
    },
    channels: {
      general: {
        channelId: env('CHAT_CHANNEL_ID'),
        secretKey: env('CHAT_CHANNEL_KEY'),
        originCode: env('CHAT_ORIGIN_CODE'),
      },
      wa: {
        channelId: env('CHAT_WA_CHANNEL_ID'),
        secretKey: env('CHAT_WA_CHANNEL_KEY'),
        originCode: env('CHAT_WA_ORIGIN_CODE'),
      },
      waba: {
        channelId: env('CHAT_WABA_CHANNEL_ID'),
        secretKey: env('CHAT_WABA_CHANNEL_KEY'),
        originCode: env('CHAT_WABA_ORIGIN_CODE'),
      },
      telegram: {
        channelId: env('CHAT_TELEGRAM_CHANNEL_ID'),
        secretKey: env('CHAT_TELEGRAM_CHANNEL_KEY'),
        originCode: env('CHAT_TELEGRAM_ORIGIN_CODE'),
      },
      telebot: {
        channelId: env('CHAT_TELEBOT_CHANNEL_ID'),
        secretKey: env('CHAT_TELEBOT_CHANNEL_KEY'),
        originCode: env('CHAT_TELEBOT_ORIGIN_CODE'),
      },
      vk: {
        channelId: env('CHAT_VK_CHANNEL_ID'),
        secretKey: env('CHAT_VK_CHANNEL_KEY'),
        originCode: env('CHAT_VK_ORIGIN_CODE'),
      },
      viber_bot: {
        channelId: env('CHAT_VIBER_BOT_CHANNEL_ID'),
        secretKey: env('CHAT_VIBER_BOT_CHANNEL_KEY'),
        originCode: env('CHAT_VIBER_BOT_ORIGIN_CODE'),
      },
      avito: {
        channelId: env('CHAT_AVITO_CHANNEL_ID'),
        secretKey: env('CHAT_AVITO_CHANNEL_KEY'),
        originCode: env('CHAT_AVITO_ORIGIN_CODE'),
      },
      ok: {
        channelId: env('CHAT_OK_CHANNEL_ID'),
        secretKey: env('CHAT_OK_CHANNEL_KEY'),
        originCode: env('CHAT_OK_ORIGIN_CODE'),
      },
      instagram: {
        channelId: env('CHAT_INSTAGRAM_CHANNEL_ID'),
        secretKey: env('CHAT_INSTAGRAM_CHANNEL_KEY'),
        originCode: env('CHAT_INSTAGRAM_ORIGIN_CODE'),
      },
      fb: {
        channelId: env('CHAT_FB_CHANNEL_ID'),
        secretKey: env('CHAT_FB_CHANNEL_KEY'),
        originCode: env('CHAT_FB_ORIGIN_CODE'),
      }
    },
    redirectUri: `${env('REDIRECT_URI')}/api/integrations/amocrm3/code`,
    widgetCode: env('WIDGET_CODE'),
    webhookUrl: env('WEBHOOK_URL') || ''
  },
  mongo: {
    uri: `mongodb://${env('MONGODB_HOST')}:${env('MONGODB_PORT')}/${env('MONGODB_DB')}` || 'mongodb://127.0.0.1:27017/amo',
  },
  amqp: {
    uri: {
      protocol: 'amqp',
      hostname: env('RABBITMQ_HOST'),
      port: parseInt(env('RABBITMQ_PORT')) || 5672,
      username: env('RABBITMQ_USER'),
      password: env('RABBITMQ_PASS'),
      vhost: env('RABBITMQ_VHOST'),
    },
    prefetchCount: 5,
    connectionInitOptions: { wait: false },
    enableControllerDiscovery: true,
    connectionManagerOptions: {
      heartbeatIntervalInSeconds: parseInt(String(env('RABBITMQ_HEARTBEAT_INTERVAL'))) || 10,
    },
  },
  amoApiLimiter: {
    reservoir: env('AMOAPI_LIMITER_RESERVOIR') || 7,
    reservoirRefreshInterval: env('AMOAPI_LIMITER_RESERVOIR_REFRESH_INTERVAL') || 1000,
    heartbitInterval: env('AMOAPI_LIMITER_HEARTBIT_INTERVAL') || 250,
    maxConcurrent: env('AMOAPI_LIMITER_MAX_CONCURRENT') || 7,
    minTime: env('AMOAPI_LIMITER_MIN_TIME') || 10,
    highWater: env('AMOAPI_LIMITER_HIGHWATER') || 1000,
  },
  services: {
    developerAlert: {
      telegram: {
        chatId: process.env.DEVELOPER_ALERT_TELEGRAM_CHAT_ID || '',
        deduplicationTtlMs: Number(process.env.DEVELOPER_ALERT_DEDUP_TTL_MS) || 30 * 60 * 1000,
      },
    },
  },
};
