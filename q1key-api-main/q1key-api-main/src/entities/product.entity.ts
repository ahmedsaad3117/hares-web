import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Institution } from "./institution.entity";
import { Branch } from "./branch.entity";

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn({ name: "product_id" })
  productId: number;

  @Column({ name: "institution_id", nullable: true })
  institutionId: number;

  @Column({ name: "branch_id", nullable: true })
  branchId: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @Column({ name: "is_visible_to_branches", default: true })
  isVisibleToBranches: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => Institution, { nullable: true })
  @JoinColumn({ name: "institution_id" })
  institution: Institution;

  @ManyToOne(() => Branch, { nullable: true })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;
}
