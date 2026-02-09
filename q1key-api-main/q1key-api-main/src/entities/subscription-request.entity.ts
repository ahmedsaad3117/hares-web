import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Institution } from "./institution.entity";
import { Branch } from "./branch.entity";
import { SubscriptionPlan } from "./subscription-plan.entity";
import { User } from "./user.entity";

/**
 * Request Status Enum
 */
export enum SubscriptionRequestStatus {
  PENDING = "Pending", // تحت المعالجة
  APPROVED = "Approved", // تم التأكيد
  REJECTED = "Rejected", // مرفوض
  CANCELLED = "Cancelled", // ملغي
}

/**
 * Requester Type Enum
 */
export enum RequesterType {
  INSTITUTION = "Institution",
  BRANCH = "Branch",
}

/**
 * Subscription Request Entity
 * Represents subscription requests from institutions or branches
 */
@Entity("subscription_requests")
export class SubscriptionRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: "requester_type",
    type: "varchar",
    length: 20,
  })
  @Index("IDX_SUB_REQ_TYPE")
  requesterType: RequesterType;

  @Column({ name: "institution_id", nullable: true })
  @Index("IDX_SUB_REQ_INSTITUTION")
  institutionId: number | null;

  @Column({ name: "branch_id", nullable: true })
  @Index("IDX_SUB_REQ_BRANCH")
  branchId: number | null;

  @Column({ name: "plan_id", nullable: true })
  @Index("IDX_SUB_REQ_PLAN")
  planId: number | null;

  @Column({ name: "custom_duration_months", nullable: true })
  customDurationMonths: number; // For custom date selection

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
  })
  amount: number; // Total amount to pay

  @Column({
    name: "status",
    type: "varchar",
    length: 20,
    default: SubscriptionRequestStatus.PENDING,
  })
  @Index("IDX_SUB_REQ_STATUS")
  status: SubscriptionRequestStatus;

  @Column({ name: "is_free", default: false })
  isFree: boolean; // For free subscriptions (compensation or trial)

  @Column({ name: "free_reason", type: "text", nullable: true })
  freeReason: string; // Reason for free subscription

  @Column({ name: "requested_start_date", type: "date", nullable: true })
  requestedStartDate: Date;

  @Column({ name: "requested_end_date", type: "date", nullable: true })
  requestedEndDate: Date;

  @Column({ type: "text", nullable: true })
  notes: string; // Customer notes

  @Column({ name: "admin_notes", type: "text", nullable: true })
  adminNotes: string; // Super Admin notes

  @Column({ name: "pending_data", type: "text", nullable: true })
  pendingData: string; // JSON string containing data for new institutions/branches

  @Column({ name: "processed_by", nullable: true })
  processedBy: number; // Super Admin who processed

  @Column({ name: "processed_at", type: "timestamp", nullable: true })
  processedAt: Date;

  @Column({ name: "cash_box_transaction_id", nullable: true })
  cashBoxTransactionId: number; // Link to cash box transaction when approved

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Institution, { nullable: true })
  @JoinColumn({ name: "institution_id" })
  institution: Institution;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;

  @ManyToOne(() => SubscriptionPlan, { nullable: true })
  @JoinColumn({ name: "plan_id" })
  plan: SubscriptionPlan;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "processed_by" })
  processor: User;
}
