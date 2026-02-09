import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Subscription Plan Entity
 * Represents different subscription packages (1 month, 3 months, 6 months, 1 year)
 */
@Entity("subscription_plans")
export class SubscriptionPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string; // e.g., "شهر واحد", "3 أشهر", "6 أشهر", "سنة كاملة"

  @Column({ name: "name_en", length: 100, nullable: true })
  nameEn: string; // e.g., "1 Month", "3 Months", "6 Months", "1 Year"

  @Column({ name: "duration_months" })
  durationMonths: number; // 1, 3, 6, 12

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
  })
  price: number; // Price in SAR

  @Column({ name: "is_active", default: true })
  isActive: boolean; // Whether this plan is visible to customers

  @Column({ name: "is_free_trial", default: false })
  isFreeTrial: boolean; // For free trial offers

  @Column({ name: "sort_order", default: 0 })
  sortOrder: number; // Display order

  @Column({ type: "text", nullable: true })
  description: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
