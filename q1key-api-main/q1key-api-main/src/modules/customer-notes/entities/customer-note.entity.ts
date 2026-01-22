import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../../entities/customer.entity';
import { User } from '../../../entities/user.entity';
import { Branch } from '../../../entities/branch.entity';
import { NoteCategory } from './note-category.enum';

@Entity('customer_notes')
export class CustomerNote {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  customer_id: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column()
  user_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  branch_id: number;

  @ManyToOne(() => Branch)
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ type: 'varchar', length: 1400 })
  note_text: string;

  @Column({
    type: 'enum',
    enum: NoteCategory,
    default: NoteCategory.GENERAL,
  })
  category: NoteCategory;

  @Column()
  created_by: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  last_edited_by: number;

  @Column({ type: 'timestamp', nullable: true })
  edited_at: Date;
}
