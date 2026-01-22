import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Loan } from './loan.entity';
import { InstallmentStatus } from './installment-status.enum';
import { Min } from 'class-validator';

@Entity('installments')
export class Installment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'loan_id' })
  loanId: number;

  @Column({ name: 'installment_number', type: 'integer' })
  @Min(1)
  installmentNumber: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @Min(0.01)
  amount: number;

  @Column({ type: 'varchar', length: 20, default: InstallmentStatus.PENDING })
  status: InstallmentStatus;

  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Loan, (loan) => loan.installments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'loan_id' })
  loan: Loan;
}

