import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Customer } from "./customer.entity";
import { User } from "./user.entity";

@Entity("search_logs")
export class SearchLog {
  @PrimaryGeneratedColumn({ name: "search_log_id" })
  searchLogId: number;

  @Column({ name: "customer_id" })
  customerId: number;

  @ManyToOne(() => Customer)
  @JoinColumn({ name: "customer_id" })
  customer: Customer;

  @Column({ name: "user_id" })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "search_query", type: "varchar", length: 500 })
  searchQuery: string;

  @Column({ name: "search_type", type: "varchar", length: 50 })
  searchType: string; // 'view', 'search', 'edit', 'list'

  @Column({ name: "ip_address", type: "varchar", length: 50, nullable: true })
  ipAddress: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
