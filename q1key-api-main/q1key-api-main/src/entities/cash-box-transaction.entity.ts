import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { CashBox } from "./cash-box.entity";
import { User } from "./user.entity";
import { Loan } from "./loan.entity";
import { Installment } from "./installment.entity";

export enum TransactionType {
  DEPOSIT = "Deposit", // إيداع
  WITHDRAWAL = "Withdrawal", // سحب
  LOAN_DISBURSEMENT = "LoanDisbursement", // صرف قرض (خصم)
  LOAN_PAYMENT = "LoanPayment", // سداد قسط (إضافة)
  SUBSCRIPTION = "Subscription", // اشتراك (للأدمن فقط)
  ADJUSTMENT = "Adjustment", // تعديل يدوي
}

@Entity("cash_box_transactions")
export class CashBoxTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "cash_box_id" })
  @Index("IDX_TXN_CASHBOX")
  cashBoxId: number;

  @Column({
    type: "varchar",
    length: 30,
    name: "transaction_type",
  })
  @Index("IDX_TXN_TYPE")
  transactionType: TransactionType;

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
  })
  amount: number;

  @Column({ name: "balance_before", type: "decimal", precision: 15, scale: 2 })
  balanceBefore: number;

  @Column({ name: "balance_after", type: "decimal", precision: 15, scale: 2 })
  balanceAfter: number;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "loan_id", nullable: true })
  @Index("IDX_TXN_LOAN")
  loanId?: number;

  @Column({ name: "installment_id", nullable: true })
  installmentId?: number;

  @Column({ name: "created_by", nullable: true })
  @Index("IDX_TXN_CREATOR")
  createdBy?: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => CashBox)
  @JoinColumn({ name: "cash_box_id" })
  cashBox: CashBox;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "created_by" })
  creator?: User;

  @ManyToOne(() => Loan, { nullable: true })
  @JoinColumn({ name: "loan_id" })
  loan?: Loan;

  @ManyToOne(() => Installment, { nullable: true })
  @JoinColumn({ name: "installment_id" })
  installment?: Installment;
}
