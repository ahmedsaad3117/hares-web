import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn({ name: "role_id" })
  roleId: number;

  @Column({ name: "role_name", unique: true, length: 50 })
  roleName: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
