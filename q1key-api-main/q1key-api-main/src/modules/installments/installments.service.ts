import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Like, EntityManager } from 'typeorm';
import { Installment } from '../../entities/installment.entity';
import { Loan } from '../../entities/loan.entity';
import { InstallmentStatus } from '../../entities/installment-status.enum';
import { CashBoxService } from '../cash-box/cash-box.service';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private installmentsRepository: Repository<Installment>,
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    private readonly cashBoxService: CashBoxService,
  ) { }

  async generateInstallments(loan: Loan, manager?: EntityManager): Promise<Installment[]> {
    const repo = manager ? manager.getRepository(Installment) : this.installmentsRepository;

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
    const baseAmount = Math.floor((totalRepayment / loan.paymentPlanMonths) * 100) / 100;
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
      const amount = i === loan.paymentPlanMonths ? baseAmount + remainder : baseAmount;

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
      order: { installmentNumber: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Installment> {
    const installment = await this.installmentsRepository.findOne({
      where: { id },
      relations: ['loan'],
    });

    if (!installment) {
      throw new NotFoundException(`Installment with ID ${id} not found`);
    }

    return installment;
  }

  async markAsPaid(id: number, paymentDate: Date, user?: any): Promise<Installment> {
    const installment = await this.findOne(id);

    // Check if installment is already paid
    if (installment.status === InstallmentStatus.PAID) {
      throw new BadRequestException('This installment has already been paid');
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
      loan.paidAmount = Number(loan.paidAmount) + Number(installment.amount);
      await this.loansRepository.save(loan);

      // Record cash box payment
      await this.cashBoxService.recordLoanPayment(
        loan.branchId,
        loan.institutionId,
        loan.loanId,
        installment.id,
        Number(installment.amount),
        user?.userId,
      );
    }

    return installment;
  }

  async findOverdue(): Promise<Installment[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await this.installmentsRepository.find({
      where: {
        status: InstallmentStatus.PENDING,
        dueDate: LessThan(today),
      },
      relations: ['loan', 'loan.customer', 'loan.branch'],
      order: { dueDate: 'ASC' },
    });
  }

  async search(searchTerm: string): Promise<Installment[]> {
    const queryBuilder = this.installmentsRepository
      .createQueryBuilder('installment')
      .leftJoinAndSelect('installment.loan', 'loan')
      .leftJoinAndSelect('loan.customer', 'customer')
      .leftJoinAndSelect('loan.branch', 'branch')
      .orderBy('installment.dueDate', 'DESC');

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      queryBuilder.where(
        '(customer.name ILIKE :term OR customer.nationalId ILIKE :term OR customer.phoneNumber ILIKE :term OR CAST(installment.amount AS TEXT) ILIKE :term)',
        { term }
      );
    }

    return await queryBuilder.getMany();
  }

  async updateOverdueStatus(): Promise<number> {
    const overdueInstallments = await this.findOverdue();

    for (const installment of overdueInstallments) {
      installment.status = InstallmentStatus.OVERDUE;
    }

    await this.installmentsRepository.save(overdueInstallments);
    return overdueInstallments.length;
  }

  async create(createInstallmentDto: CreateInstallmentDto): Promise<Installment> {
    const installment = this.installmentsRepository.create({
      ...createInstallmentDto,
      status: createInstallmentDto.status || InstallmentStatus.PENDING,
    });
    return await this.installmentsRepository.save(installment);
  }

  async update(id: number, updateInstallmentDto: UpdateInstallmentDto): Promise<Installment> {
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
      }
    }

    await this.installmentsRepository.remove(installment);
  }
}
