import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Loan } from './loan.entity';
import { TrustStatus } from './trust-status.enum';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { CustomerRelation } from './customer-relation.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn({ name: 'customer_id' })
  customerId: number;

  @Column({ name: 'institution_id', nullable: true })
  institutionId?: number;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'national_id', unique: true, length: 50 })
  nationalId: string;

  @Column({ name: 'phone_number', unique: true, length: 50 })
  phoneNumber: string;

  @Column({
    type: 'enum',
    enum: TrustStatus,
    default: TrustStatus.UNVERIFIED,
    name: 'trust_status',
  })
  trustStatus: TrustStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Institution)
  @JoinColumn({ name: 'institution_id' })
  institution: Institution;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => Loan, (loan) => loan.customer)
  loans: Loan[];

  @OneToMany(() => CustomerRelation, (relation) => relation.customer)
  relations: CustomerRelation[];
}
