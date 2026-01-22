import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming this exists
// import { RolesGuard } from '../auth/guards/roles.guard'; // Assuming this exists

@Controller('reports')
// @UseGuards(JwtAuthGuard) // Uncomment when ready
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('general-stats')
    async getGeneralStats(@Query() filter: ReportFilterDto) {
        return this.reportsService.getGeneralStats(filter);
    }

    @Get('cash-box')
    async getCashBoxReport(@Query() filter: ReportFilterDto) {
        return this.reportsService.getCashBoxReport(filter);
    }

    @Get('customers')
    async getCustomersReport(@Query() filter: ReportFilterDto) {
        return this.reportsService.getCustomersReport(filter);
    }

    @Get('loans')
    async getLoansReport(@Query() filter: ReportFilterDto) {
        return this.reportsService.getLoansReport(filter);
    }

    @Get('installments')
    async getInstallmentsReport(@Query() filter: ReportFilterDto) {
        return this.reportsService.getInstallmentsReport(filter);
    }

    @Get('unified')
    async getUnifiedReport(@Query() filter: ReportFilterDto) {
        return this.reportsService.getUnifiedReport(filter);
    }
}
