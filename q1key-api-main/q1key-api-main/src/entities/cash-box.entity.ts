import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Institution } from './institution.entity';

export enum CashBoxType {
    BRANCH = 'Branch',           // صندوق فرع
    INSTITUTION = 'Institution', // صندوق مؤسسة (بدون فروع)
    ADMIN = 'Admin',             // صندوق الأدمن (اشتراكات)
}

@Entity('cash_boxes')
export class CashBox {
    @PrimaryGeneratedColumn({ name: 'cash_box_id' })
    cashBoxId: number;

    @Column({ name: 'branch_id', nullable: true })
    branchId?: number;

    @Column({ name: 'institution_id', nullable: true })
    institutionId?: number;

    @Column({
        type: 'varchar',
        length: 20,
        default: CashBoxType.BRANCH,
        name: 'box_type',
    })
    boxType: CashBoxType;

    @Column({
        name: 'balance',
        type: 'decimal',
        precision: 15,
        scale: 2,
        default: 0,
    })
    balance: number;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branch_id' })
    branch?: Branch;

    @ManyToOne(() => Institution, { nullable: true })
    @JoinColumn({ name: 'institution_id' })
    institution?: Institution;
}
