import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, EntityManager, DataSource } from "typeorm";
import { Installment } from "../../entities/installment.entity";
import { Loan, LoanStatus } from "../../entities/loan.entity";
import { InstallmentStatus } from "../../entities/installment-status.enum";
import { CashBoxService } from "../cash-box/cash-box.service";
import { CreateInstallmentDto } from "./dto/create-installment.dto";
import { UpdateInstallmentDto } from "./dto/update-installment.dto";

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private installmentsRepository: Repository<Installment>,
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    private readonly cashBoxService: CashBoxService,
    private dataSource: DataSource,
  ) { }

  async generateInstallments(
    loan: Loan,
    manager?: EntityManager,
  ): Promise<Installment[]> {
    const repo = manager
      ? manager.getRepository(Installment)
      : this.installmentsRepository;

    // Check if installments already exist for this loan
    const existingInstallments = await repo.find({
      where: { loanId: loan.loanId },
    });

    if (existingInstallments.length > 0) {
      // Installments already exist, return them
      return existingInstallments;
    }

    const installments: Installment[] = [];

    // Calculate total repayment amount (Principal + Profit)
    const principal = Number(loan.principalAmount);
    const profit = Number(loan.profitAmount || 0);
    const totalRepayment = principal + profit;

    // Calculate base installment amount with proper rounding
    const baseAmount =
      Math.floor((totalRepayment / loan.paymentPlanMonths) * 100) / 100;
    // Calculate total with base amount and find the remainder
    const totalWithBase = baseAmount * loan.paymentPlanMonths;
    const remainder = Number((totalRepayment - totalWithBase).toFixed(2));

    for (let i = 1; i <= loan.paymentPlanMonths; i++) {
      let dueDate: Date;
      if (loan.dueDate) {
        dueDate = new Date(loan.dueDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1));
      } else {
        dueDate = new Date(loan.createdAt);
        dueDate.setMonth(dueDate.getMonth() + i);
      }

      // Add remainder to the last installment to ensure total matches principal
      const amount =
        i === loan.paymentPlanMonths ? baseAmount + remainder : baseAmount;

      const installment = repo.create({
        loanId: loan.loanId,
        installmentNumber: i,
        dueDate: dueDate,
        amount: amount,
        status: InstallmentStatus.PENDING,
      });

      installments.push(installment);
    }

    return await repo.save(installments);
  }

  async findByLoan(loanId: number): Promise<Installment[]> {
    return await this.installmentsRepository.find({
      where: { loanId },
      order: { installmentNumber: "ASC" },
    });
  }

  async findOne(id: number, user?: any): Promise<Installment> {
    const installment = await this.installmentsRepository.findOne({
      where: { id },
      relations: ["loan", "loan.branch"],
    });

    if (!installment) {
      throw new NotFoundException(`Installment with ID ${id} not found`);
    }

    // Security check: Entity Independence
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName !== "Super Admin") {
      if (roleName === "Institution") {
        if (
          installment.loan.institutionId !== user.institutionId ||
          installment.loan.branchId !== null
        ) {
          throw new NotFoundException(
            `Installment with ID ${id} not found or access denied`,
          );
        }
      } else if (roleName === "Branch") {
        if (installment.loan.branchId !== user.branchId) {
          throw new NotFoundException(
            `Installment with ID ${id} not found or access denied`,
          );
        }
      } else if (user.institutionId) {
        const loanInstId =
          installment.loan.branch?.institutionId ||
          installment.loan.institutionId;
        if (loanInstId !== user.institutionId) {
          throw new NotFoundException(
            `Installment with ID ${id} not found or access denied`,
          );
        }
      }
    }

    return installment;
  }

  async markAsPaid(
    id: number,
    paymentDate: Date,
    user?: any,
  ): Promise<Installment> {
    const installment = await this.findOne(id);

    // Check if installment is already paid
    if (installment.status === InstallmentStatus.PAID) {
      throw new BadRequestException("This installment has already been paid");
    }

    // Check if previous installments are paid (sequential payment enforcement)
    if (installment.installmentNumber > 1) {
      const previousInstallments = await this.installmentsRepository.find({
        where: {
          loanId: installment.loanId,
          installmentNumber: LessThan(installment.installmentNumber),
        },
      });

      const unpaidPrevious = previousInstallments.find(
        (inst) => inst.status !== InstallmentStatus.PAID,
      );

      if (unpaidPrevious) {
        throw new BadRequestException(
          `Cannot pay installment #${installment.installmentNumber}. Please pay installment #${unpaidPrevious.installmentNumber} first.`,
        );
      }
    }

    installment.status = InstallmentStatus.PAID;
    installment.paymentDate = paymentDate;

    await this.installmentsRepository.save(installment);

    // Update loan's paid amount
    const loan = await this.loansRepository.findOne({
      where: { loanId: installment.loanId },
    });

    if (loan) {
      const installmentAmount = parseFloat(
        installment.amount?.toString() || "0",
      );
      await this.updateLoanStatus(loan.loanId, installment.id);

      // Record cash box payment
      await this.cashBoxService.recordLoanPayment(
        loan.branchId,
        loan.institutionId,
        loan.loanId,
        installment.id,
        installmentAmount,
        user?.userId,
      );
    }

    return installment;
  }

  async findOverdue(user?: any): Promise<Installment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const queryBuilder = this.installmentsRepository
      .createQueryBuilder("i")
      .leftJoinAndSelect("i.loan", "l")
      .leftJoinAndSelect("l.customer", "c")
      .leftJoinAndSelect("l.branch", "b")
      .where("i.status = :status", { status: InstallmentStatus.PENDING })
      .andWhere("i.dueDate < :today", { today })
      .orderBy("i.dueDate", "ASC");

    // Security Filter: Entity Independence
    const roleName = user?.role?.roleName || user?.roleName;
    if (user && roleName === "Institution" && user.institutionId) {
      queryBuilder.andWhere(
        "l.institutionId = :institutionId AND l.branchId IS NULL",
        { institutionId: user.institutionId },
      );
    } else if (user && roleName === "Branch" && user.branchId) {
      queryBuilder.andWhere("l.branchId = :branchId", {
        branchId: user.branchId,
      });
    } else if (user && roleName !== "Super Admin" && user.institutionId) {
      queryBuilder.andWhere(
        "(b.institutionId = :institutionId OR l.institutionId = :institutionId)",
        { institutionId: user.institutionId },
      );
    }

    return await queryBuilder.getMany();
  }

  /**
   * Search installments
   * OPTIMIZED: Uses Raw SQL for better performance
   */
  async search(searchTerm: string, user?: any): Promise<any[]> {
    try {
      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Search term filtering
      if (searchTerm && searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        whereClauses.push(`(
          c.name ILIKE $${paramIndex} OR 
          c.national_id ILIKE $${paramIndex} OR 
          c.phone_number ILIKE $${paramIndex} OR 
          CAST(i.amount AS TEXT) ILIKE $${paramIndex}
        )`);
        params.push(term);
        paramIndex++;
      }

      // Security Filtering: Entity Independence
      const roleName = user?.role?.roleName || user?.roleName;
      if (user && roleName === "Institution" && user.institutionId) {
        whereClauses.push(
          `l.institution_id = $${paramIndex} AND l.branch_id IS NULL`,
        );
        params.push(user.institutionId);
        paramIndex++;
      } else if (user && roleName === "Branch" && user.branchId) {
        whereClauses.push(`l.branch_id = $${paramIndex}`);
        params.push(user.branchId);
        paramIndex++;
      } else if (user && roleName !== "Super Admin" && user.institutionId) {
        whereClauses.push(
          `(b.institution_id = $${paramIndex} OR l.institution_id = $${paramIndex})`,
        );
        params.push(user.institutionId);
        paramIndex++;
      }

      const whereClause =
        whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const query = `
        SELECT 
          i.id,
          i.loan_id as "loanId",
          i.installment_number as "installmentNumber",
          i.due_date as "dueDate",
          i.amount,
          i.status,
          i.payment_date as "paymentDate",
          json_build_object(
            'loanId', l.loan_id,
            'principalAmount', l.principal_amount,
            'institutionId', l.institution_id,
            'branchId', l.branch_id,
            'customer', json_build_object(
              'customerId', c.customer_id,
              'name', c.name,
              'nationalId', c.national_id,
              'phoneNumber', c.phone_number
            ),
            'branch', CASE WHEN b.branch_id IS NOT NULL THEN
              json_build_object(
                'branchId', b.branch_id,
                'name', b.name,
                'phoneNumber', b.phone_number,
                'institution', json_build_object(
                  'institutionId', bi.institution_id,
                  'name', bi.name,
                  'phoneNumber', bi.phone_number
                )
              )
            ELSE NULL END,
            'institution', CASE WHEN li.institution_id IS NOT NULL THEN
              json_build_object(
                'institutionId', li.institution_id,
                'name', li.name,
                'phoneNumber', li.phone_number
              )
            ELSE NULL END
          ) as loan
        FROM installments i
        LEFT JOIN loans l ON i.loan_id = l.loan_id
        LEFT JOIN customers c ON l.customer_id = c.customer_id
        LEFT JOIN branches b ON l.branch_id = b.branch_id
        LEFT JOIN institutions bi ON b.institution_id = bi.institution_id
        LEFT JOIN institutions li ON l.institution_id = li.institution_id
        ${whereClause}
        ORDER BY i.id DESC
      `;

      return await this.dataSource.query(query, params);
    } catch (error) {
      console.error("Error in installments search:", error);
      throw error;
    }
  }

  async updateOverdueStatus(): Promise<number> {
    const overdueInstallments = await this.findOverdue();

    for (const installment of overdueInstallments) {
      installment.status = InstallmentStatus.OVERDUE;
    }

    await this.installmentsRepository.save(overdueInstallments);
    return overdueInstallments.length;
  }

  async create(
    createInstallmentDto: CreateInstallmentDto,
  ): Promise<Installment> {
    const installment = this.installmentsRepository.create({
      ...createInstallmentDto,
      status: createInstallmentDto.status || InstallmentStatus.PENDING,
    });
    return await this.installmentsRepository.save(installment);
  }

  async update(
    id: number,
    updateInstallmentDto: UpdateInstallmentDto,
  ): Promise<Installment> {
    const installment = await this.findOne(id);
    Object.assign(installment, updateInstallmentDto);
    return await this.installmentsRepository.save(installment);
  }

  async remove(id: number): Promise<void> {
    const installment = await this.installmentsRepository.findOne({
      where: { id: id },
    });

    if (!installment) {
      // If it doesn't exist, we consider it already deleted
      return;
    }

    // If paid, revert loan balance
    if (installment.status === InstallmentStatus.PAID) {
      const loan = await this.loansRepository.findOne({
        where: { loanId: installment.loanId },
      });

      if (loan) {
        // Revert paid amount
        const currentPaid = Number(loan.paidAmount);
        const installmentAmount = Number(installment.amount);
        loan.paidAmount = currentPaid - installmentAmount;

        // Ensure we don't go below 0 purely by float errors
        if (loan.paidAmount < 0) loan.paidAmount = 0;

        await this.loansRepository.save(loan);
        await this.updateLoanStatus(loan.loanId);
      }
    }

    await this.installmentsRepository.remove(installment);
  }

  /**
   * Recalculates and updates the status of a loan based on its installments
   * @param loanId The ID of the loan to update
   * @param recentlyPaidInstallmentId Optional ID of an installment that was just marked as paid
   */
  async syncLoanStatus(
    loanId: number,
    recentlyPaidInstallmentId?: number,
  ): Promise<void> {
    const loan = await this.loansRepository.findOne({ where: { loanId } });
    if (!loan) return;

    const allInstallments = await this.installmentsRepository.find({
      where: { loanId },
    });

    if (allInstallments.length === 0) return;

    // Determine status based on all installments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let allPaid = true;
    let hasOverdue = false;

    for (const inst of allInstallments) {
      // Check status, taking into account the one just paid if provided
      const status =
        recentlyPaidInstallmentId && inst.id === recentlyPaidInstallmentId
          ? InstallmentStatus.PAID
          : inst.status;

      if (status !== InstallmentStatus.PAID) {
        allPaid = false;
        // Check if overdue
        if (new Date(inst.dueDate) < today) {
          hasOverdue = true;
        }
      }
    }

    const oldStatus = loan.status;
    if (allPaid) {
      loan.status = LoanStatus.PAID;
    } else if (hasOverdue) {
      loan.status = LoanStatus.LATE;
    } else {
      loan.status = LoanStatus.ACTIVE;
    }

    // Also update paidAmount to ensure it matches precisely
    const totalPaid = allInstallments
      .filter(
        (i) =>
          (recentlyPaidInstallmentId && i.id === recentlyPaidInstallmentId) ||
          i.status === InstallmentStatus.PAID,
      )
      .reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0);

    loan.paidAmount = totalPaid;

    if (loan.status !== oldStatus || loan.paidAmount !== totalPaid) {
      await this.loansRepository.save(loan);
    }
  }

  private async updateLoanStatus(
    loanId: number,
    recentlyPaidInstallmentId?: number,
  ): Promise<void> {
    return this.syncLoanStatus(loanId, recentlyPaidInstallmentId);
  }
}
