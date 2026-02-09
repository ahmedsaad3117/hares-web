import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In } from 'typeorm';
import { CashBox, CashBoxType } from '../../entities/cash-box.entity';
import { CashBoxTransaction, TransactionType } from '../../entities/cash-box-transaction.entity';
import { Branch } from '../../entities/branch.entity';
import { Institution } from '../../entities/institution.entity';
import {
    DepositDto,
    WithdrawDto,
    TransactionFilterDto,
    CashBoxResponseDto,
    TransactionResponseDto,
    CashBoxReportDto,
} from './dto/cash-box.dto';

@Injectable()
export class CashBoxService {
    constructor(
        @InjectRepository(CashBox)
        private cashBoxRepository: Repository<CashBox>,
        @InjectRepository(CashBoxTransaction)
        private transactionRepository: Repository<CashBoxTransaction>,
        @InjectRepository(Branch)
        private branchRepository: Repository<Branch>,
        @InjectRepository(Institution)
        private institutionRepository: Repository<Institution>,
        private dataSource: DataSource,
    ) { }

    // Get or create cash box for a branch
    async getOrCreateBranchCashBox(branchId: number, manager?: any): Promise<CashBox> {
        const repo = manager ? manager.getRepository(CashBox) : this.cashBoxRepository;
        const branchRepo = manager ? manager.getRepository(Branch) : this.branchRepository;

        let cashBox = await repo.findOne({
            where: { branchId, boxType: CashBoxType.BRANCH },
            relations: ['branch', 'branch.institution'],
        });

        if (!cashBox) {
            const branch = await branchRepo.findOne({
                where: { branchId },
            });
            if (!branch) {
                throw new NotFoundException(`Branch ${branchId} not found`);
            }

            cashBox = repo.create({
                branchId,
                institutionId: branch.institutionId,
                boxType: CashBoxType.BRANCH,
                balance: 0,
            });
            cashBox = await repo.save(cashBox);
        }

        return cashBox;
    }

    // Get or create cash box for institution (without branches)
    async getOrCreateInstitutionCashBox(institutionId: number, manager?: any): Promise<CashBox> {
        const repo = manager ? manager.getRepository(CashBox) : this.cashBoxRepository;

        let cashBox = await repo.findOne({
            where: { institutionId, boxType: CashBoxType.INSTITUTION, branchId: undefined },
            relations: ['institution'],
        });

        if (!cashBox) {
            cashBox = repo.create({
                institutionId,
                boxType: CashBoxType.INSTITUTION,
                balance: 0,
            });
            cashBox = await repo.save(cashBox);
        }

        return cashBox;
    }

    // Get or create Admin cash box (for subscriptions)
    async getOrCreateAdminCashBox(): Promise<CashBox> {
        let cashBox = await this.cashBoxRepository.findOne({
            where: { boxType: CashBoxType.ADMIN },
        });

        if (!cashBox) {
            cashBox = this.cashBoxRepository.create({
                boxType: CashBoxType.ADMIN,
                balance: 0,
            });
            cashBox = await this.cashBoxRepository.save(cashBox);
        }

        return cashBox;
    }

    // Get cash box for current user
    async getCashBoxForUser(user: any): Promise<CashBoxResponseDto> {
        let cashBox: CashBox;

        if (user.role?.roleName === 'Super Admin') {
            cashBox = await this.getOrCreateAdminCashBox();
        } else if (user.branchId) {
            cashBox = await this.getOrCreateBranchCashBox(user.branchId);
        } else if (user.institutionId) {
            // Check if institution has branches
            const branches = await this.branchRepository.find({
                where: { institutionId: user.institutionId },
            });

            if (branches.length > 0) {
                // Return aggregated view of all branch cash boxes
                return this.getInstitutionAggregatedCashBox(user.institutionId);
            } else {
                cashBox = await this.getOrCreateInstitutionCashBox(user.institutionId);
            }
        } else {
            throw new BadRequestException('User has no associated branch or institution');
        }

        return this.toCashBoxResponse(cashBox);
    }

    // Get aggregated cash box for institution (sum of all branches)
    async getInstitutionAggregatedCashBox(institutionId: number): Promise<CashBoxResponseDto> {
        const institution = await this.institutionRepository.findOne({
            where: { institutionId },
        });

        if (!institution) {
            throw new NotFoundException(`Institution ${institutionId} not found`);
        }

        const branchCashBoxes = await this.cashBoxRepository.find({
            where: {
                institutionId,
                boxType: In([CashBoxType.BRANCH, CashBoxType.INSTITUTION]),
            },
            relations: ['branch'],
        });

        const totalBalance = branchCashBoxes.reduce(
            (sum, box) => sum + parseFloat(box.balance.toString()),
            0
        );

        return {
            cashBoxId: 0, // Aggregated view has no single ID
            institutionId,
            boxType: 'Aggregated',
            balance: totalBalance,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            institutionName: institution.name,
        };
    }

    // Get all branch cash boxes for institution
    async getBranchCashBoxes(institutionId: number): Promise<CashBoxResponseDto[]> {
        // Fetch existing boxes (Branches + Institution Head Office)
        const cashBoxes = await this.cashBoxRepository.find({
            where: {
                institutionId,
                boxType: In([CashBoxType.BRANCH, CashBoxType.INSTITUTION]),
            },
            relations: ['branch'],
        });

        // Optimization: Don't force create all boxes during listing. 
        // Boxes are created lazily when a transaction happens or when getting individual balance.
        // This makes list loading much faster for institutions with many branches.

        return cashBoxes.map(box => this.toCashBoxResponse(box));
    }

    // Deposit money
    async deposit(cashBoxId: number, dto: DepositDto, userId: number): Promise<TransactionResponseDto> {
        return this.dataSource.transaction(async (manager) => {
            // Use increment for atomic update (prevents race conditions)
            await manager.increment(CashBox, { cashBoxId }, 'balance', dto.amount);

            // Fetch updated state for record keeping
            const updatedBox = await manager.findOne(CashBox, { where: { cashBoxId } });
            if (!updatedBox) throw new NotFoundException(`Cash box ${cashBoxId} not found`);

            const balanceBefore = parseFloat(updatedBox.balance.toString()) - dto.amount;
            const balanceAfter = parseFloat(updatedBox.balance.toString());

            // Create transaction record
            const transaction = manager.create(CashBoxTransaction, {
                cashBoxId,
                transactionType: TransactionType.DEPOSIT,
                amount: dto.amount,
                balanceBefore,
                balanceAfter,
                description: dto.description || 'إيداع',
                createdBy: userId,
            });

            await manager.save(transaction);
            return this.toTransactionResponse(transaction);
        });
    }

    // Withdraw money
    async withdraw(cashBoxId: number, dto: WithdrawDto, userId: number): Promise<TransactionResponseDto> {
        return this.dataSource.transaction(async (manager) => {
            // Use decrement for atomic update (prevents race conditions)
            await manager.decrement(CashBox, { cashBoxId }, 'balance', dto.amount);

            // Fetch updated state for record keeping
            const updatedBox = await manager.findOne(CashBox, { where: { cashBoxId } });
            if (!updatedBox) throw new NotFoundException(`Cash box ${cashBoxId} not found`);

            const balanceBefore = parseFloat(updatedBox.balance.toString()) + dto.amount;
            const balanceAfter = parseFloat(updatedBox.balance.toString());

            // Create transaction record
            const transaction = manager.create(CashBoxTransaction, {
                cashBoxId,
                transactionType: TransactionType.WITHDRAWAL,
                amount: dto.amount,
                balanceBefore,
                balanceAfter,
                description: dto.description || 'سحب',
                createdBy: userId,
            });

            await manager.save(transaction);
            return this.toTransactionResponse(transaction);
        });
    }

    // Record loan disbursement (called from loans service)
    async recordLoanDisbursement(
        branchId: number | undefined,
        institutionId: number | undefined,
        loanId: number,
        amount: number,
        userId: number,
        manager?: any,
        description?: string,
    ): Promise<{ transaction: CashBoxTransaction; warning?: string }> {
        const queryRunner = manager || this.dataSource.manager;

        let cashBoxId: number;
        if (branchId) {
            const box = await this.getOrCreateBranchCashBox(branchId, queryRunner);
            cashBoxId = box.cashBoxId;
        } else if (institutionId) {
            const box = await this.getOrCreateInstitutionCashBox(institutionId, queryRunner);
            cashBoxId = box.cashBoxId;
        } else {
            throw new BadRequestException('Either branchId or institutionId must be provided');
        }

        // Atomic update
        await queryRunner.decrement(CashBox, { cashBoxId }, 'balance', amount);

        // Fetch updated state for record keeping
        const updatedBox = await queryRunner.findOne(CashBox, { where: { cashBoxId } });
        if (!updatedBox) throw new NotFoundException(`Cash box ${cashBoxId} not found`);
        const balanceAfter = parseFloat(updatedBox.balance.toString());
        const balanceBefore = balanceAfter + amount;

        let warning: string | undefined;
        if (balanceAfter < 0) {
            warning = `تحذير: رصيد الصندوق سالب (${balanceAfter.toFixed(2)})`;
        }

        // Create transaction
        const txRepo = queryRunner.getRepository(CashBoxTransaction);
        const transaction = txRepo.create({
            cashBoxId,
            transactionType: TransactionType.LOAN_DISBURSEMENT,
            amount: amount,
            balanceBefore,
            balanceAfter,
            loanId,
            description: description || `صرف قرض رقم ${loanId}`,
            createdBy: userId,
        });

        await txRepo.save(transaction);
        return { transaction, warning };
    }

    // Record loan payment (called from installments service)
    async recordLoanPayment(
        branchId: number | undefined,
        institutionId: number | undefined,
        loanId: number,
        installmentId: number,
        amount: number,
        userId?: number,
    ): Promise<CashBoxTransaction> {
        return this.dataSource.transaction(async (manager) => {
            let cashBoxId: number;
            if (branchId) {
                const box = await this.getOrCreateBranchCashBox(branchId, manager);
                cashBoxId = box.cashBoxId;
            } else if (institutionId) {
                const box = await this.getOrCreateInstitutionCashBox(institutionId, manager);
                cashBoxId = box.cashBoxId;
            } else {
                throw new BadRequestException('Either branchId or institutionId must be provided');
            }

            // Atomic update
            await manager.increment(CashBox, { cashBoxId }, 'balance', amount);

            // Fetch updated state for record
            const updatedBox = await manager.findOne(CashBox, { where: { cashBoxId } });
            if (!updatedBox) throw new NotFoundException(`Cash box ${cashBoxId} not found`);
            const balanceAfter = parseFloat(updatedBox.balance.toString());
            const balanceBefore = balanceAfter - amount;

            // Create transaction record
            const transaction = manager.create(CashBoxTransaction, {
                cashBoxId,
                transactionType: TransactionType.LOAN_PAYMENT,
                amount: amount,
                balanceBefore,
                balanceAfter,
                loanId,
                installmentId,
                description: `سداد قسط للقرض رقم ${loanId}`,
                createdBy: userId,
            });

            await manager.save(transaction);
            return transaction;
        });
    }

    // Get transactions
    async getTransactions(
        cashBoxId: number,
        filter: TransactionFilterDto,
    ): Promise<{ data: TransactionResponseDto[]; total: number }> {
        const { page = 1, limit = 20, type, fromDate, toDate } = filter;
        const skip = (page - 1) * limit;

        const queryBuilder = this.transactionRepository
            .createQueryBuilder('t')
            .leftJoinAndSelect('t.creator', 'creator')
            .leftJoinAndSelect('t.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .where('t.cashBoxId = :cashBoxId', { cashBoxId })
            .orderBy('t.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        if (type) {
            queryBuilder.andWhere('t.transactionType = :type', { type });
        }

        if (fromDate) {
            queryBuilder.andWhere('t.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
        }

        if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            queryBuilder.andWhere('t.createdAt <= :toDate', { toDate: endDate });
        }

        const [transactions, total] = await queryBuilder.getManyAndCount();

        return {
            data: transactions.map(t => this.toTransactionResponse(t)),
            total,
        };
    }

    // Get all transactions for an institution (aggregated)
    async getInstitutionTransactions(
        institutionId: number,
        filter: TransactionFilterDto,
    ): Promise<{ data: TransactionResponseDto[]; total: number }> {
        const { page = 1, limit = 20, type, fromDate, toDate } = filter;
        const skip = (page - 1) * limit;

        const queryBuilder = this.transactionRepository
            .createQueryBuilder('t')
            .innerJoin('CashBox', 'cb', 'cb.cashBoxId = t.cashBoxId')
            .leftJoinAndSelect('t.creator', 'creator')
            .leftJoinAndSelect('t.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .where('cb.institutionId = :institutionId', { institutionId })
            .orderBy('t.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        if (type) {
            queryBuilder.andWhere('t.transactionType = :type', { type });
        }

        if (fromDate) {
            queryBuilder.andWhere('t.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
        }

        if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            queryBuilder.andWhere('t.createdAt <= :toDate', { toDate: endDate });
        }

        const [transactions, total] = await queryBuilder.getManyAndCount();

        return {
            data: transactions.map(t => this.toTransactionResponse(t)),
            total,
        };
    }

    // Get report
    // Get report
    async getReport(
        cashBoxId: number,
        fromDate?: string,
        toDate?: string,
    ): Promise<CashBoxReportDto> {
        const cashBox = await this.cashBoxRepository.findOne({
            where: { cashBoxId },
            relations: ['branch', 'institution'],
        });

        if (!cashBox) {
            throw new NotFoundException(`Cash box ${cashBoxId} not found`);
        }

        const queryBuilder = this.transactionRepository.createQueryBuilder('t')
            .leftJoinAndSelect('t.creator', 'creator')
            .leftJoinAndSelect('t.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .where('t.cashBoxId = :cashBoxId', { cashBoxId })
            .orderBy('t.createdAt', 'DESC');

        if (fromDate && fromDate !== 'undefined' && fromDate !== '') {
            queryBuilder.andWhere('t.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
        }

        if (toDate && toDate !== 'undefined' && toDate !== '') {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            queryBuilder.andWhere('t.createdAt <= :toDate', { toDate: endDate });
        }

        const transactions = await queryBuilder.getMany();

        return this.calculateReportStats(cashBox, transactions);
    }

    // Get aggregated report for institution
    async getInstitutionReport(
        institutionId: number,
        fromDate?: string,
        toDate?: string,
    ): Promise<CashBoxReportDto> {
        // Get aggregated cashbox structure
        const aggregatedBox = await this.getInstitutionAggregatedCashBox(institutionId);

        // Convert DTO back to minimal entity-like object for calculator
        // Note: We need a CashBox entity or similar check for the response DTO
        // Since calculateReportStats needs CashBox entity for toCashBoxResponse, 
        // but here we already have ResponseDTO. 
        // Let's adjust helper.

        const queryBuilder = this.transactionRepository.createQueryBuilder('t')
            .innerJoin('CashBox', 'cb', 'cb.cashBoxId = t.cashBoxId')
            .leftJoinAndSelect('t.creator', 'creator')
            .leftJoinAndSelect('t.loan', 'loan')
            .leftJoinAndSelect('loan.customer', 'customer')
            .where('cb.institutionId = :institutionId', { institutionId })
            .orderBy('t.createdAt', 'DESC');

        if (fromDate && fromDate !== 'undefined' && fromDate !== '') {
            queryBuilder.andWhere('t.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
        }

        if (toDate && toDate !== 'undefined' && toDate !== '') {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            queryBuilder.andWhere('t.createdAt <= :toDate', { toDate: endDate });
        }

        const transactions = await queryBuilder.getMany();

        return {
            cashBox: aggregatedBox,
            ...this.calculateStats(transactions),
            transactions: transactions.map(t => this.toTransactionResponse(t)),
        };
    }

    private calculateReportStats(cashBox: CashBox, transactions: CashBoxTransaction[]): CashBoxReportDto {
        return {
            cashBox: this.toCashBoxResponse(cashBox),
            ...this.calculateStats(transactions),
            transactions: transactions.map(t => this.toTransactionResponse(t)),
        };
    }

    private calculateStats(transactions: CashBoxTransaction[]) {
        const totals = {
            totalDeposits: 0,
            totalWithdrawals: 0,
            totalLoanDisbursements: 0,
            totalLoanPayments: 0,
        };

        transactions.forEach(t => {
            const amount = parseFloat(t.amount.toString());
            switch (t.transactionType) {
                case TransactionType.DEPOSIT:
                    totals.totalDeposits += amount;
                    break;
                case TransactionType.WITHDRAWAL:
                    totals.totalWithdrawals += amount;
                    break;
                case TransactionType.LOAN_DISBURSEMENT:
                    totals.totalLoanDisbursements += amount;
                    break;
                case TransactionType.LOAN_PAYMENT:
                    totals.totalLoanPayments += amount;
                    break;
            }
        });

        return {
            ...totals,
            netChange: totals.totalDeposits + totals.totalLoanPayments - totals.totalWithdrawals - totals.totalLoanDisbursements
        };
    }

    private toCashBoxResponse(cashBox: CashBox): CashBoxResponseDto {
        return {
            cashBoxId: cashBox.cashBoxId,
            branchId: cashBox.branchId,
            institutionId: cashBox.institutionId,
            boxType: cashBox.boxType,
            balance: parseFloat(cashBox.balance.toString()),
            isActive: cashBox.isActive,
            createdAt: cashBox.createdAt,
            updatedAt: cashBox.updatedAt,
            branchName: cashBox.branch?.name,
            institutionName: cashBox.institution?.name || cashBox.branch?.institution?.name,
        };
    }

    private toTransactionResponse(t: CashBoxTransaction): TransactionResponseDto {
        // For Loan Disbursement:
        // Stored value is positive for money OUT (5000) and negative for money IN (-1000, refund).
        // User wants to see Negative for OUT (-5000) and Positive for IN (+1000).
        // So we negate the stored value for display.
        const amount = t.transactionType === TransactionType.LOAN_DISBURSEMENT
            ? -parseFloat(t.amount.toString())
            : parseFloat(t.amount.toString());

        // Extract customer name from loan relations if available
        let customerName: string | undefined = undefined;
        if (t.loan && t.loan.customer) {
            customerName = t.loan.customer.name;
        }

        return {
            id: t.id,
            cashBoxId: t.cashBoxId,
            transactionType: t.transactionType,
            amount: amount,
            balanceBefore: parseFloat(t.balanceBefore.toString()),
            balanceAfter: parseFloat(t.balanceAfter.toString()),
            description: t.description,
            loanId: t.loanId,
            installmentId: t.installmentId,
            createdBy: t.createdBy,
            createdByName: t.creator?.name,
            customerName: customerName,
            createdAt: t.createdAt,
        };
    }
}
