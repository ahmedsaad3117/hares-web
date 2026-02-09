import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Announcement Entity
 * Represents system-wide announcements/banners
 */
@Entity("announcements")
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "text_ar", type: "text" })
  textAr: string; // Arabic text

  @Column({ name: "text_en", type: "text" })
  textEn: string; // English text

  @Column({ name: "background_color", length: 20, default: "#3b82f6" })
  backgroundColor: string; // e.g., '#3b82f6' (blue)

  @Column({ name: "text_color", length: 20, default: "#ffffff" })
  textColor: string; // e.g., '#ffffff' (white)

  @Column({ name: "is_active", default: false })
  isActive: boolean; // Whether this announcement is currently displayed

  @Column({ name: "created_by" })
  createdBy: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  creator: User;
}
