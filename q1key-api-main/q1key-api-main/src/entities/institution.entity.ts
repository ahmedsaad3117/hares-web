import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Branch } from './branch.entity';

@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn({ name: 'institution_id' })
  institutionId: number;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'tax_id', length: 100, nullable: true })
  taxId: string;

  @Column({ name: 'phone_number', length: 50, nullable: true })
  phoneNumber: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ name: 'max_users', default: 5 })
  maxUsers: number;

  @Column({ name: 'can_create_branches', default: true })
  canCreateBranches: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Branch, (branch) => branch.institution)
  branches: Branch[];

  @OneToMany('User', (user: any) => user.institution)
  users: any[];
}
