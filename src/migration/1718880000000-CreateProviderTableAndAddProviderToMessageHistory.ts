import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProviderTableAndAddProviderToMessageHistory1718880000000 implements MigrationInterface {
  name = 'CreateProviderTableAndAddProviderToMessageHistory1718880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create provider table
    await queryRunner.query(`
            CREATE TABLE provider (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE
            )
        `);

    // 2. Insert initial providers
    await queryRunner.query(`
            INSERT INTO provider (name) VALUES ('whatsapp'), ('instagram')
        `);

    // 3. Add provider_id column to message_history (nullable for now)
    await queryRunner.query(`
            ALTER TABLE message_history ADD COLUMN provider_id INTEGER
        `);

    // 4. Set provider_id = 1 for all existing rows (whatsapp)
    await queryRunner.query(`
            UPDATE message_history SET provider_id = 1
        `);

    // 5. Set NOT NULL constraint and add foreign key
    await queryRunner.query(`
            ALTER TABLE message_history ALTER COLUMN provider_id SET NOT NULL
        `);
    await queryRunner.query(`
            ALTER TABLE message_history ADD CONSTRAINT message_history_provider_fk FOREIGN KEY (provider_id) REFERENCES provider(id)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
            ALTER TABLE message_history DROP CONSTRAINT message_history_provider_fk
        `);
    // Drop provider_id column
    await queryRunner.query(`
            ALTER TABLE message_history DROP COLUMN provider_id
        `);
    // Drop provider table
    await queryRunner.query(`
            DROP TABLE provider
        `);
  }
}
