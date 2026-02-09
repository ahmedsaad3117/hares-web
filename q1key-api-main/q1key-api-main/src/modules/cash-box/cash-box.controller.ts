import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { CashBoxService } from "./cash-box.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import {
  DepositDto,
  WithdrawDto,
  TransactionFilterDto,
} from "./dto/cash-box.dto";

@Controller("cash-box")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashBoxController {
  constructor(private readonly cashBoxService: CashBoxService) {}

  // Get current user's cash box
  @Get()
  @Roles("Super Admin", "Institution", "Branch")
  async getMyCashBox(@CurrentUser() user: any) {
    return this.cashBoxService.getCashBoxForUser(user);
  }

  // Unified Data Endpoint (Dashboard style)
  @Get("unified")
  @Roles("Super Admin", "Institution", "Branch")
  async getUnifiedData(
    @CurrentUser() user: any,
    @Query() filter: TransactionFilterDto,
  ) {
    return this.cashBoxService.getUnifiedCashBoxData(user, filter);
  }

  // Get all branch cash boxes for institution
  @Get("institution/branches")
  @Roles("Super Admin", "Institution")
  async getBranchCashBoxes(
    @CurrentUser() user: any,
    @Query("institutionId") queryInstitutionId?: number,
  ) {
    const roleName = user.role?.roleName || user.roleName || "";
    console.log(
      `[CashBox] getBranchCashBoxes called by role: ${roleName}, user current institutionId: ${user.institutionId}`,
    );

    // Determine target institution ID
    // Super Admin must provide it, Institution uses their own
    const isSuperAdmin = roleName.toLowerCase().includes("admin");
    const targetInstitutionId = isSuperAdmin
      ? queryInstitutionId
      : user.institutionId;

    console.log(
      `[CashBox] targetInstitutionId determined: ${targetInstitutionId}`,
    );

    if (!targetInstitutionId) {
      return [];
    }

    return this.cashBoxService.getBranchCashBoxes(Number(targetInstitutionId));
  }

  // Get my transactions
  @Get("transactions")
  @Roles("Super Admin", "Institution", "Branch")
  async getMyTransactions(
    @CurrentUser() user: any,
    @Query() filter: TransactionFilterDto,
  ) {
    const cashBox = await this.cashBoxService.getCashBoxForUser(user);

    if (cashBox.boxType === "Aggregated" && user.institutionId) {
      return this.cashBoxService.getInstitutionTransactions(
        user.institutionId,
        filter,
      );
    }

    return this.cashBoxService.getTransactions(cashBox.cashBoxId, filter);
  }

  // Get my report
  @Get("report")
  @Roles("Super Admin", "Institution", "Branch")
  async getMyReport(
    @CurrentUser() user: any,
    @Query("fromDate") fromDate: string,
    @Query("toDate") toDate: string,
  ) {
    const cashBox = await this.cashBoxService.getCashBoxForUser(user);

    if (cashBox.boxType === "Aggregated" && user.institutionId) {
      return this.cashBoxService.getInstitutionReport(
        user.institutionId,
        fromDate,
        toDate,
      );
    }

    return this.cashBoxService.getReport(cashBox.cashBoxId, fromDate, toDate);
  }

  // Get specific cash box by ID
  @Get(":id")
  @Roles("Super Admin", "Institution")
  async getCashBox(@Param("id", ParseIntPipe) id: number) {
    return this.cashBoxService.getCashBoxForUser({ cashBoxId: id });
  }

  // Deposit money
  @Post("deposit")
  @Roles("Super Admin", "Institution", "Branch")
  async deposit(@Body() dto: DepositDto, @CurrentUser() user: any) {
    const cashBox = await this.cashBoxService.getCashBoxForUser(user);
    return this.cashBoxService.deposit(cashBox.cashBoxId, dto, user.userId);
  }

  // Deposit to specific cash box
  @Post(":id/deposit")
  @Roles("Super Admin", "Institution")
  async depositToCashBox(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: DepositDto,
    @CurrentUser() user: any,
  ) {
    return this.cashBoxService.deposit(id, dto, user.userId);
  }

  // Withdraw money
  @Post("withdraw")
  @Roles("Super Admin", "Institution", "Branch")
  async withdraw(@Body() dto: WithdrawDto, @CurrentUser() user: any) {
    const cashBox = await this.cashBoxService.getCashBoxForUser(user);
    return this.cashBoxService.withdraw(cashBox.cashBoxId, dto, user.userId);
  }

  // Withdraw from specific cash box
  @Post(":id/withdraw")
  @Roles("Super Admin", "Institution")
  async withdrawFromCashBox(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: WithdrawDto,
    @CurrentUser() user: any,
  ) {
    return this.cashBoxService.withdraw(id, dto, user.userId);
  }

  // Get transactions for specific cash box
  @Get(":id/transactions")
  @Roles("Super Admin", "Institution")
  async getTransactions(
    @Param("id", ParseIntPipe) id: number,
    @Query() filter: TransactionFilterDto,
  ) {
    return this.cashBoxService.getTransactions(id, filter);
  }

  // Get report for specific cash box
  @Get(":id/report")
  @Roles("Super Admin", "Institution")
  async getReport(
    @Param("id", ParseIntPipe) id: number,
    @Query("fromDate") fromDate: string,
    @Query("toDate") toDate: string,
  ) {
    return this.cashBoxService.getReport(id, fromDate, toDate);
  }
}
