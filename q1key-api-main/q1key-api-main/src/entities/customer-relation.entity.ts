import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from "typeorm";
import { Customer } from "./customer.entity";
import { Institution } from "./institution.entity";
import { Branch } from "./branch.entity";
import { User } from "./user.entity";

@Entity("customer_relations")
export class CustomerRelation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "customer_id" })
  customerId: number;

  @Column({ name: "institution_id" })
  institutionId: number;

  @Column({ name: "branch_id", nullable: true })
  branchId: number | null;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date;

  @Column({ name: "deleted_by", nullable: true })
  deletedBy: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => Customer, { onDelete: "CASCADE" })
  @JoinColumn({ name: "customer_id" })
  customer: Customer;

  @ManyToOne(() => Institution)
  @JoinColumn({ name: "institution_id" })
  institution: Institution;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "deleted_by" })
  deleter: User;
}
