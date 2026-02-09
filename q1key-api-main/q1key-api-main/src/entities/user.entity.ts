import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Role } from "./role.entity";
import { Institution } from "./institution.entity";
import { Branch } from "./branch.entity";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn({ name: "user_id" })
  userId: number;

  @Column({ name: "role_id" })
  roleId: number;

  @Column({ name: "institution_id", nullable: true })
  institutionId: number;

  @Column({ name: "branch_id", nullable: true })
  branchId: number;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: "phone_number", unique: true, length: 50, nullable: true })
  phoneNumber: string;

  @Column({ name: "national_id", unique: true, length: 50, nullable: true })
  nationalId: string;

  @Column({ name: "password_hash", length: 255 })
  passwordHash: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({
    name: "active_session_id",
    type: "varchar",
    nullable: true,
    length: 255,
  })
  activeSessionId: string | null;

  @Column({ name: "last_activity_at", type: "timestamp", nullable: true })
  lastActivityAt: Date | null;

  @ManyToOne(() => Institution, (institution) => institution.users)
  @JoinColumn({ name: "institution_id" })
  institution: Institution;

  @ManyToOne(() => Branch, (branch) => branch.users)
  @JoinColumn({ name: "branch_id" })
  branch: Branch;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => Role)
  @JoinColumn({ name: "role_id" })
  role: Role;
}
