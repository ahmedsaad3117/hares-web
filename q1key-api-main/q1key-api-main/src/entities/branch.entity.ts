import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Institution } from "./institution.entity";
import { User } from "./user.entity";

@Entity("branches")
export class Branch {
  @PrimaryGeneratedColumn({ name: "branch_id" })
  branchId: number;

  @Column({ name: "institution_id" })
  institutionId: number;

  @Column({ length: 255 })
  name: string;

  @Column({ name: "phone_number", length: 50, nullable: true })
  phoneNumber: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "total_loans", default: 0 })
  totalLoans: number;

  @Column({ name: "maximum_loans", default: 0 })
  maximumLoans: number;

  @Column({ name: "expiration_date", type: "timestamp", nullable: true })
  expirationDate: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => Institution, (institution) => institution.branches)
  @JoinColumn({ name: "institution_id" })
  institution: Institution;

  @OneToMany(() => User, (user) => user.branch)
  users: User[];
}
