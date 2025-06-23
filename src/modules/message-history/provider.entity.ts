import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'provider' })
export class Provider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;
}