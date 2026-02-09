import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Telegram Settings Entity
 * Stores configuration for Telegram bot notifications
 */
@Entity("telegram_settings")
export class TelegramSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "bot_token", type: "varchar", length: 255, nullable: true })
  botToken: string | null;

  @Column({ name: "chat_id", type: "varchar", length: 100, nullable: true })
  chatId: string | null;

  @Column({ name: "is_enabled", default: false })
  isEnabled: boolean;

  @Column({ name: "notify_new_requests", default: true })
  notifyNewRequests: boolean; // إشعار عند طلب اشتراك جديد

  @Column({ name: "notify_renewals", default: true })
  notifyRenewals: boolean; // إشعار عند طلب تجديد

  @Column({ name: "allow_action_buttons", default: true })
  allowActionButtons: boolean; // السماح بأزرار القبول والرفض في الإشعار

  @Column({ name: "last_test_at", type: "timestamp", nullable: true })
  lastTestAt: Date | null;

  @Column({ name: "last_test_success", default: false })
  lastTestSuccess: boolean;

  @Column({ name: "last_test_error", type: "text", nullable: true })
  lastTestError: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
