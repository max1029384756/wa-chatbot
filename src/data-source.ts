import { DataSource } from 'typeorm';
import { MessageHistory } from './modules/message-history/message-history.entity';
import { Provider } from './modules/message-history/provider.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: +(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'gs_wa_agent_db',
  entities: [MessageHistory, Provider],
  migrations: ['src/migration/*.ts'],
  synchronize: false,
});
