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
        // Ensure all branches have cash boxes
        const branches = await this.branchRepository.find({ where: { institutionId } });
        for (const branch of branches) {
            await this.getOrCreateBranchCashBox(branch.branchId);
        }

        // Fetch all boxes (Branches + Institution Head Office)
        const cashBoxes = await this.cashBoxRepository.find({
            where: {
                institutionId,
                boxType: In([CashBoxType.BRANCH, CashBoxType.INSTITUTION]),
            },
            relations: ['branch'],
        });

        return cashBoxes.map(box => this.toCashBoxResponse(box));
    }

    // Deposit money
    async deposit(cashBoxId: number, dto: DepositDto, userId: number): Promise<TransactionResponseDto> {
        return this.dataSource.transaction(async (manager) => {
            const cashBox = await manager.findOne(CashBox, {
                where: { cashBoxId },
            });

            if (!cashBox) {
                throw new NotFoundException(`Cash box ${cashBoxId} not found`);
            }

            const balanceBefore = parseFloat(cashBox.balance.toString());
            const balanceAfter = balanceBefore + dto.amount;

            // Update balance
            cashBox.balance = balanceAfter;
            await manager.save(cashBox);

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
            const cashBox = await manager.findOne(CashBox, {
                where: { cashBoxId },
            });

            if (!cashBox) {
                throw new NotFoundException(`Cash box ${cashBoxId} not found`);
            }

            const balanceBefore = parseFloat(cashBox.balance.toString());
            const balanceAfter = balanceBefore - dto.amount;

            // Update balance (can go negative)
            cashBox.balance = balanceAfter;
            await manager.save(cashBox);

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
        let cashBox: CashBox;

        if (branchId) {
            cashBox = await this.getOrCreateBranchCashBox(branchId, manager);
        } else if (institutionId) {
            cashBox = await this.getOrCreateInstitutionCashBox(institutionId, manager);
        } else {
            throw new BadRequestException('Either branchId or institutionId must be provided');
        }

        const balanceBefore = parseFloat(cashBox.balance.toString());
        const balanceAfter = balanceBefore - amount;

        let warning: string | undefined;
        if (balanceAfter < 0) {
            warning = `تحذير: رصيد الصندوق سالب (${balanceAfter.toFixed(2)})`;
        }

        // Update balance
        cashBox.balance = balanceAfter;
        const cbRepo = manager ? manager.getRepository(CashBox) : this.cashBoxRepository;
        await cbRepo.save(cashBox);

        // Create transaction
        const txRepo = manager ? manager.getRepository(CashBoxTransaction) : this.transactionRepository;
        const transaction = txRepo.create({
            cashBoxId: cashBox.cashBoxId,
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
        let cashBox: CashBox;

        if (branchId) {
            cashBox = await this.getOrCreateBranchCashBox(branchId);
        } else if (institutionId) {
            cashBox = await this.getOrCreateInstitutionCashBox(institutionId);
        } else {
            throw new BadRequestException('Either branchId or institutionId must be provided');
        }

        const balanceBefore = parseFloat(cashBox.balance.toString());
        const balanceAfter = balanceBefore + amount;

        // Update balance
        cashBox.balance = balanceAfter;
        await this.cashBoxRepository.save(cashBox);

        // Create transaction
        const transaction = this.transactionRepository.create({
            cashBoxId: cashBox.cashBoxId,
            transactionType: TransactionType.LOAN_PAYMENT,
            amount,
            balanceBefore,
            balanceAfter,
            loanId,
            installmentId,
            description: `سداد قسط رقم ${installmentId} للقرض ${loanId}`,
            createdBy: userId,
        });

        return this.transactionRepository.save(transaction);
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
    async getReport(
        cashBoxId: number,
        fromDate: string,
        toDate: string,
    ): Promise<CashBoxReportDto> {
        const cashBox = await this.cashBoxRepository.findOne({
            where: { cashBoxId },
            relations: ['branch', 'institution'],
        });

        if (!cashBox) {
            throw new NotFoundException(`Cash box ${cashBoxId} not found`);
        }

        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);

        const transactions = await this.transactionRepository.find({
            where: {
                cashBoxId,
                createdAt: Between(startDate, endDate),
            },
            relations: ['creator'],
            order: { createdAt: 'DESC' },
        });

        const totals = {
            deposits: 0,
            withdrawals: 0,
            loanDisbursements: 0,
            loanPayments: 0,
        };

        transactions.forEach(t => {
            const amount = parseFloat(t.amount.toString());
            switch (t.transactionType) {
                case TransactionType.DEPOSIT:
                    totals.deposits += amount;
                    break;
                case TransactionType.WITHDRAWAL:
                    totals.withdrawals += amount;
                    break;
                case TransactionType.LOAN_DISBURSEMENT:
                    totals.loanDisbursements += amount;
                    break;
                case TransactionType.LOAN_PAYMENT:
                    totals.loanPayments += amount;
                    break;
            }
        });

        return {
            cashBox: this.toCashBoxResponse(cashBox),
            totalDeposits: totals.deposits,
            totalWithdrawals: totals.withdrawals,
            totalLoanDisbursements: totals.loanDisbursements,
            totalLoanPayments: totals.loanPayments,
            netChange: totals.deposits + totals.loanPayments - totals.withdrawals - totals.loanDisbursements,
            transactions: transactions.map(t => this.toTransactionResponse(t)),
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
            createdAt: t.createdAt,
        };
    }
}
