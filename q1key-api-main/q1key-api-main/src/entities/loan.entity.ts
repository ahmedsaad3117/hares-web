import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Customer } from './customer.entity';
import { Branch } from './branch.entity';
import { Institution } from './institution.entity';
import { Product } from './product.entity';
import { User } from './user.entity';
import { Installment } from './installment.entity';
import { Min, Max } from 'class-validator';

export enum LoanStatus {
  ACTIVE = 'Active',
  PAID = 'Paid',
  LATE = 'Late',
  FINISHED = 'Finished',
}

@Entity('loans')
export class Loan {
  @PrimaryGeneratedColumn({ name: 'loan_id' })
  loanId: number;

  @Column({ name: 'customer_id' })
  customerId: number;

  @Column({ name: 'branch_id', nullable: true })
  branchId?: number;

  @Column({ name: 'institution_id', nullable: true })
  institutionId?: number;

  @Column({ name: 'product_id' })
  productId: number;

  @Column({ name: 'principal_amount', type: 'decimal', precision: 10, scale: 2 })
  principalAmount: number;

  @Column({ name: 'profit_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  profitAmount: number;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Column({ name: 'payment_plan_months', type: 'integer', default: 1 })
  @Min(1)
  @Max(12)
  paymentPlanMonths: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Customer, (customer) => customer.loans)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: 'branch_id' })
  branch?: Branch;

  @ManyToOne(() => Institution, { nullable: true })
  @JoinColumn({ name: 'institution_id' })
  institution?: Institution;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => Installment, (installment) => installment.loan, { cascade: true })
  installments: Installment[];
}
