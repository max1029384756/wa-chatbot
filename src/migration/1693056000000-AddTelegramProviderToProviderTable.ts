import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTelegramProviderToProviderTable1693056000000 implements MigrationInterface {
  name = 'AddTelegramProviderToProviderTable1693056000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO provider (name) VALUES ('telegram')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM provider WHERE name = 'telegram'
    `);
  }
}
