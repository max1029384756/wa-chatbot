import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'message_history' })
export class MessageHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clientId: string;

  @Column('text')
  question: string;

  @Column('text')
  answer: string;

  @CreateDateColumn()
  date: Date;

  @Column('float')
  generationTime: number; // in seconds or ms
}
