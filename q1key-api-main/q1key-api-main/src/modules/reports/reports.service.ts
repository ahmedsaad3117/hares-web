import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportFilterDto } from './dto/report-filter.dto';

@Injectable()
export class ReportsService {
    constructor(private dataSource: DataSource) { }

    // ========== GENERAL STATS ==========
    async getGeneralStats(filter: ReportFilterDto) {
        const { institutionId, branchId, startDate, endDate } = filter;

        let whereClause = '1=1';
        const params: any[] = [];

        if (institutionId) {
            whereClause += ' AND "institution_id" = $' + (params.length + 1);
            params.push(institutionId);
        }
        if (branchId) {
            whereClause += ' AND "branch_id" = $' + (params.length + 1);
            params.push(branchId);
        }

        // 1. Total Customers
        let customerQuery = '';
        let customerParams = [...params];

        if (branchId) {
            let custWhere = '1=1';
            const custP: any[] = [];
            if (institutionId) {
                custWhere += ' AND c."institution_id" = $' + (custP.length + 1);
                custP.push(institutionId);
            }
            if (branchId) {
                custWhere += ' AND u."branch_id" = $' + (custP.length + 1);
                custP.push(branchId);
            }

            customerQuery = `
                SELECT COUNT(*) as count 
                FROM customers c
                LEFT JOIN users u ON c."created_by" = u."user_id"
                WHERE ${custWhere}
             `;
            customerParams = custP;
        } else {
            customerQuery = `SELECT COUNT(*) as count FROM customers WHERE ${whereClause}`;
            customerParams = params;
        }

        if (startDate) {
            customerQuery += ` AND "created_at" >= '${startDate}'`;
        }
        if (endDate) {
            customerQuery += ` AND "created_at" <= '${endDate}'`;
        }

        const customersCount = await this.dataSource.query(customerQuery, customerParams);

        // 2. Active Loans
        let loansQuery = `SELECT COUNT(*) as count, SUM("principal_amount") as total_amount FROM loans WHERE ${whereClause}`;
        if (startDate) {
            loansQuery += ` AND "created_at" >= '${startDate}'`;
        }
        if (endDate) {
            loansQuery += ` AND "created_at" <= '${endDate}'`;
        }
        const loansStats = await this.dataSource.query(loansQuery, params);

        // 3. Loans by Status
        let loansStatusQuery = `SELECT status, COUNT(*) as count FROM loans WHERE ${whereClause}`;
        if (startDate) {
            loansStatusQuery += ` AND "created_at" >= '${startDate}'`;
        }
        if (endDate) {
            loansStatusQuery += ` AND "created_at" <= '${endDate}'`;
        }
        loansStatusQuery += ` GROUP BY status`;
        const loansByStatus = await this.dataSource.query(loansStatusQuery, params);

        return {
            totalCustomers: parseInt(customersCount[0]?.count || 0),
            totalLoans: parseInt(loansStats[0]?.count || 0),
            totalLoanAmount: parseFloat(loansStats[0]?.total_amount || 0),
            loansByStatus: loansByStatus.map((s: any) => ({ status: s.status, count: parseInt(s.count) }))
        };
    }

    // ========== CASH BOX REPORT (DETAILED) ==========
    async getCashBoxReport(filter: ReportFilterDto) {
        const { institutionId, branchId, startDate, endDate, type } = filter;

        // Summary Query - using correct column names from entity
        let summaryQuery = `
            SELECT 
                t.transaction_type, 
                COALESCE(SUM(t.amount), 0) as total_amount,
                COUNT(*) as count
            FROM cash_box_transactions t
            LEFT JOIN cash_boxes cb ON t."cash_box_id" = cb."cash_box_id"
            WHERE 1=1
        `;

        const params: any[] = [];

        if (institutionId) {
            summaryQuery += ` AND cb."institution_id" = $${params.length + 1}`;
            params.push(institutionId);
        }
        if (branchId) {
            summaryQuery += ` AND cb."branch_id" = $${params.length + 1}`;
            params.push(branchId);
        }
        if (startDate) {
            summaryQuery += ` AND t."created_at" >= '${startDate}'`;
        }
        if (endDate) {
            summaryQuery += ` AND t."created_at" <= '${endDate}'`;
        }
        if (type) {
            summaryQuery += ` AND t.transaction_type = $${params.length + 1}`;
            params.push(type);
        }

        summaryQuery += ` GROUP BY t.transaction_type`;

        let summary: any[] = [];
        try {
            summary = await this.dataSource.query(summaryQuery, params);
        } catch (err) {
            console.error('Cash Box Summary Query Error:', err);
            summary = [];
        }

        // Detailed Transactions Query - using correct column names
        let detailQuery = `
            SELECT 
                t.id,
                t.transaction_type,
                t.amount,
                t.description,
                t.loan_id,
                t.installment_id,
                t.created_at,
                cb.branch_id,
                b.name as branch_name,
                u.name as created_by_name
            FROM cash_box_transactions t
            LEFT JOIN cash_boxes cb ON t."cash_box_id" = cb."cash_box_id"
            LEFT JOIN branches b ON cb."branch_id" = b."branch_id"
            LEFT JOIN users u ON t."created_by" = u."user_id"
            WHERE 1=1
        `;

        const detailParams: any[] = [];

        if (institutionId) {
            detailQuery += ` AND cb."institution_id" = $${detailParams.length + 1}`;
            detailParams.push(institutionId);
        }
        if (branchId) {
            detailQuery += ` AND cb."branch_id" = $${detailParams.length + 1}`;
            detailParams.push(branchId);
        }
        if (startDate) {
            detailQuery += ` AND t."created_at" >= '${startDate}'`;
        }
        if (endDate) {
            detailQuery += ` AND t."created_at" <= '${endDate}'`;
        }
        if (type) {
            detailQuery += ` AND t.transaction_type = $${detailParams.length + 1}`;
            detailParams.push(type);
        }

        detailQuery += ` ORDER BY t."created_at" DESC LIMIT 500`;

        let transactions: any[] = [];
        try {
            transactions = await this.dataSource.query(detailQuery, detailParams);
        } catch (err) {
            console.error('Cash Box Detail Query Error:', err);
            transactions = [];
        }

        // Calculate totals - matching entity TransactionType values
        const inTypes = ['Deposit', 'LoanPayment', 'Subscription'];
        let totalIn = 0;
        let totalOut = 0;

        summary.forEach((item: any) => {
            const amount = parseFloat(item.total_amount) || 0;
            if (inTypes.includes(item.transaction_type)) {
                totalIn += amount;
            } else {
                totalOut += amount;
            }
        });

        return {
            summary: summary.map((r: any) => ({
                type: r.transaction_type,
                totalAmount: parseFloat(r.total_amount) || 0,
                count: parseInt(r.count)
            })),
            transactions: transactions.map((t: any) => ({
                id: t.id,
                type: t.transaction_type,
                amount: parseFloat(t.amount),
                description: t.description,
                referenceId: t.loan_id || t.installment_id,
                referenceType: t.loan_id ? 'Loan' : (t.installment_id ? 'Installment' : null),
                branchName: t.branch_name,
                createdBy: t.created_by_name,
                createdAt: t.created_at
            })),
            totals: {
                totalIn,
                totalOut,
                netBalance: totalIn - totalOut
            }
        };
    }

    // ========== CUSTOMERS REPORT (DETAILED) ==========
    async getCustomersReport(filter: ReportFilterDto) {
        const { institutionId, branchId, startDate, endDate } = filter;

        let whereClause = '1=1';
        const params: any[] = [];
        let joins = '';

        if (institutionId) {
            whereClause += ' AND c."institution_id" = $' + (params.length + 1);
            params.push(institutionId);
        }

        if (branchId) {
            joins += ' LEFT JOIN users u ON c."created_by" = u."user_id"';
            whereClause += ' AND u."branch_id" = $' + (params.length + 1);
            params.push(branchId);
        }

        let dateFilter = '';
        if (startDate) dateFilter += ` AND c."created_at" >= '${startDate}'`;
        if (endDate) dateFilter += ` AND c."created_at" <= '${endDate}'`;

        // 1. Growth Data
        const growthQuery = `
          SELECT CAST(c."created_at" AS DATE) as date, COUNT(*) as count 
          FROM customers c
          ${joins}
          WHERE ${whereClause} ${dateFilter}
          GROUP BY CAST(c."created_at" AS DATE) 
          ORDER BY date ASC
        `;
        const growthStats = await this.dataSource.query(growthQuery, params);

        // 2. Total Count
        const totalQuery = `SELECT COUNT(*) as count FROM customers c ${joins} WHERE ${whereClause} ${dateFilter}`;
        const total = await this.dataSource.query(totalQuery, params);

        // 3. Analytics Query
        const analyticsQuery = `
            SELECT 
                c.customer_id,
                c.name,
                c.phone_number,
                c.trust_status,
                c.created_at,
                COUNT(l.loan_id) as total_loans,
                SUM(CASE WHEN l.status = 'Paid' OR l.status = 'Finished' THEN 1 ELSE 0 END) as finished_loans,
                SUM(CASE WHEN l.status = 'Active' THEN 1 ELSE 0 END) as active_loans,
                SUM(CASE WHEN l.status = 'Late' THEN 1 ELSE 0 END) as troubled_loans,
                COALESCE(SUM(l.principal_amount), 0) as total_value,
                MAX(l.created_at) as last_loan_date
            FROM customers c
            ${joins}
            LEFT JOIN loans l ON c.customer_id = l.customer_id
            WHERE ${whereClause}
            GROUP BY c.customer_id, c.name, c.phone_number, c.trust_status, c.created_at
        `;

        const customerData = await this.dataSource.query(analyticsQuery, params);

        const segments = {
            vip: 0,
            active: 0,
            normal: 0,
            low_engagement: 0,
            risk: 0
        };

        const scoredCustomers: any[] = [];
        let totalCLV = 0;
        let churnCandidates = 0;

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        customerData.forEach((cust: any) => {
            const totalLoans = parseInt(cust.total_loans);
            const activeLoans = parseInt(cust.active_loans);
            const troubledLoans = parseInt(cust.troubled_loans);
            const totalValue = parseFloat(cust.total_value);
            const lastLoanDate = cust.last_loan_date ? new Date(cust.last_loan_date) : null;

            totalCLV += totalValue;

            let score = 50;
            if (activeLoans > 0) score += 10;
            if (troubledLoans > 0) score -= 30;
            if (totalLoans > 2) score += 10;
            if (totalValue > 50000) score += 20;
            if (cust.trust_status === 'Trusted') score += 10;
            if (cust.trust_status === 'Blocked') score = 0;

            let segment = 'normal';

            if (troubledLoans > 0 || cust.trust_status === 'Blocked' || score < 30) {
                segment = 'risk';
                segments.risk++;
            } else if (totalValue > 50000 && troubledLoans === 0) {
                segment = 'vip';
                segments.vip++;
            } else if (activeLoans > 0) {
                segment = 'active';
                segments.active++;
            } else if (!lastLoanDate || lastLoanDate < ninetyDaysAgo) {
                segment = 'low_engagement';
                segments.low_engagement++;
                churnCandidates++;
            } else {
                segments.normal++;
            }

            scoredCustomers.push({
                customerId: cust.customer_id,
                name: cust.name,
                phoneNumber: cust.phone_number,
                trustStatus: cust.trust_status,
                createdAt: cust.created_at,
                totalLoans,
                activeLoans,
                finishedLoans: parseInt(cust.finished_loans),
                troubledLoans,
                totalValue,
                lastActivity: lastLoanDate,
                segment,
                score
            });
        });

        const totalCustomersCount = customerData.length || 1;

        const retentionRate = ((totalCustomersCount - churnCandidates) / totalCustomersCount * 100).toFixed(1);
        const churnRate = (churnCandidates / totalCustomersCount * 100).toFixed(1);
        const avgCLV = (totalCLV / totalCustomersCount).toFixed(2);
        const activeRate = ((segments.active + segments.vip) / totalCustomersCount * 100).toFixed(1);

        return {
            total: parseInt(total[0]?.count || 0),
            growth: growthStats.map((g: any) => ({ date: g.date, count: parseInt(g.count) })),
            segments,
            kpi: {
                retentionRate: parseFloat(retentionRate),
                churnRate: parseFloat(churnRate),
                avgCLV: parseFloat(avgCLV),
                activeRate: parseFloat(activeRate)
            },
            customers: scoredCustomers.sort((a, b) => b.score - a.score),
            topCustomers: scoredCustomers.sort((a, b) => b.score - a.score).slice(0, 20),
            insights: {
                riskCount: segments.risk,
                vipPotential: scoredCustomers.filter(c => c.segment === 'active' && c.totalValue > 30000).length,
                churnRisk: churnCandidates
            }
        };
    }

    // ========== LOANS REPORT (DETAILED) ==========
    async getLoansReport(filter: ReportFilterDto) {
        const { institutionId, branchId, startDate, endDate, status, customerId } = filter;
        let whereClause = '1=1';
        const params: any[] = [];

        if (institutionId) {
            whereClause += ' AND l."institution_id" = $' + (params.length + 1);
            params.push(institutionId);
        }
        if (branchId) {
            whereClause += ' AND l."branch_id" = $' + (params.length + 1);
            params.push(branchId);
        }
        if (status) {
            whereClause += ' AND l."status" = $' + (params.length + 1);
            params.push(status);
        }
        if (customerId) {
            whereClause += ' AND l."customer_id" = $' + (params.length + 1);
            params.push(customerId);
        }

        let dateFilter = '';
        if (startDate) dateFilter += ` AND l."created_at" >= '${startDate}'`;
        if (endDate) dateFilter += ` AND l."created_at" <= '${endDate}'`;

        // By Product Summary
        const productQuery = `
            SELECT p.name as product_name, COUNT(l."loan_id") as count, COALESCE(SUM(l."principal_amount"), 0) as total_amount
            FROM loans l
            LEFT JOIN products p ON l."product_id" = p."product_id"
            WHERE ${whereClause} ${dateFilter}
            GROUP BY p.name
        `;
        const productStats = await this.dataSource.query(productQuery, params);

        // By Status Summary
        const statusQuery = `
            SELECT status, COUNT(*) as count, COALESCE(SUM("principal_amount"), 0) as total_amount
            FROM loans l
            WHERE ${whereClause} ${dateFilter}
            GROUP BY status
        `;
        const statusStats = await this.dataSource.query(statusQuery, params);

        // Detailed Loans List
        const detailQuery = `
            SELECT 
                l.loan_id,
                l.principal_amount,
                l.profit_amount,
                l.paid_amount,
                l.status,
                l.payment_plan_months,
                l.due_date,
                l.created_at,
                c.name as customer_name,
                c.phone_number as customer_phone,
                p.name as product_name,
                b.name as branch_name
            FROM loans l
            LEFT JOIN customers c ON l."customer_id" = c."customer_id"
            LEFT JOIN products p ON l."product_id" = p."product_id"
            LEFT JOIN branches b ON l."branch_id" = b."branch_id"
            WHERE ${whereClause} ${dateFilter}
            ORDER BY l."created_at" DESC
            LIMIT 500
        `;
        const loans = await this.dataSource.query(detailQuery, params);

        // Calculate totals
        const totalPrincipal = loans.reduce((sum: number, l: any) => sum + parseFloat(l.principal_amount || 0), 0);
        const totalProfit = loans.reduce((sum: number, l: any) => sum + parseFloat(l.profit_amount || 0), 0);
        const totalPaid = loans.reduce((sum: number, l: any) => sum + parseFloat(l.paid_amount || 0), 0);

        return {
            byProduct: productStats.map((p: any) => ({
                name: p.product_name || 'Unknown',
                count: parseInt(p.count),
                amount: parseFloat(p.total_amount || 0)
            })),
            byStatus: statusStats.map((s: any) => ({
                status: s.status,
                count: parseInt(s.count),
                amount: parseFloat(s.total_amount || 0)
            })),
            loans: loans.map((l: any) => ({
                loanId: l.loan_id,
                principalAmount: parseFloat(l.principal_amount),
                profitAmount: parseFloat(l.profit_amount),
                paidAmount: parseFloat(l.paid_amount),
                remaining: parseFloat(l.principal_amount) + parseFloat(l.profit_amount) - parseFloat(l.paid_amount),
                status: l.status,
                paymentPlanMonths: l.payment_plan_months,
                dueDate: l.due_date,
                createdAt: l.created_at,
                customerName: l.customer_name,
                customerPhone: l.customer_phone,
                productName: l.product_name,
                branchName: l.branch_name
            })),
            totals: {
                count: loans.length,
                totalPrincipal,
                totalProfit,
                totalPaid,
                totalRemaining: totalPrincipal + totalProfit - totalPaid
            }
        };
    }

    // ========== INSTALLMENTS REPORT (DETAILED) ==========
    async getInstallmentsReport(filter: ReportFilterDto) {
        const { institutionId, branchId, startDate, endDate, status, customerId } = filter;
        let whereClause = '1=1';
        const params: any[] = [];

        if (institutionId) {
            whereClause += ` AND l."institution_id" = $${params.length + 1}`;
            params.push(institutionId);
        }
        if (branchId) {
            whereClause += ` AND l."branch_id" = $${params.length + 1}`;
            params.push(branchId);
        }
        if (status) {
            whereClause += ` AND i."status" = $${params.length + 1}`;
            params.push(status);
        }
        if (customerId) {
            whereClause += ` AND l."customer_id" = $${params.length + 1}`;
            params.push(customerId);
        }

        let dateFilter = '';
        if (startDate) dateFilter += ` AND i."due_date" >= '${startDate}'`;
        if (endDate) dateFilter += ` AND i."due_date" <= '${endDate}'`;

        // Summary by Status
        const summaryQuery = `
            SELECT 
                i.status, 
                COUNT(*) as count, 
                COALESCE(SUM(i.amount), 0) as total_amount
            FROM installments i
            JOIN loans l ON i."loan_id" = l."loan_id"
            WHERE ${whereClause} ${dateFilter}
            GROUP BY i.status
        `;

        let stats: any[] = [];
        try {
            stats = await this.dataSource.query(summaryQuery, params);
        } catch (err) {
            console.error('Installments Summary Error:', err);
            stats = [];
        }

        // Detailed Installments List
        const detailQuery = `
            SELECT 
                i.id as installment_id,
                i.installment_number,
                i.amount,
                i.status,
                i.due_date,
                i.payment_date,
                l.loan_id,
                l.principal_amount as loan_amount,
                c.name as customer_name,
                c.phone_number as customer_phone,
                b.name as branch_name
            FROM installments i
            JOIN loans l ON i."loan_id" = l."loan_id"
            LEFT JOIN customers c ON l."customer_id" = c."customer_id"
            LEFT JOIN branches b ON l."branch_id" = b."branch_id"
            WHERE ${whereClause} ${dateFilter}
            ORDER BY i."due_date" ASC
            LIMIT 500
        `;

        let installments: any[] = [];
        try {
            installments = await this.dataSource.query(detailQuery, params);
        } catch (err) {
            console.error('Installments Detail Error:', err);
            installments = [];
        }

        // Calculate totals
        const totalAmount = installments.reduce((sum: number, i: any) => sum + parseFloat(i.amount || 0), 0);
        const paidCount = installments.filter((i: any) => i.status === 'Paid').length;
        const pendingCount = installments.filter((i: any) => i.status === 'Pending').length;
        const overdueCount = installments.filter((i: any) => i.status === 'Pending' && new Date(i.due_date) < new Date()).length;

        return {
            byStatus: stats.map((s: any) => ({
                status: s.status,
                count: parseInt(s.count),
                amount: parseFloat(s.total_amount || 0)
            })),
            installments: installments.map((i: any) => ({
                installmentId: i.installment_id,
                installmentNumber: i.installment_number,
                amount: parseFloat(i.amount),
                status: i.status,
                dueDate: i.due_date,
                paymentDate: i.payment_date,
                loanId: i.loan_id,
                loanAmount: parseFloat(i.loan_amount),
                customerName: i.customer_name,
                customerPhone: i.customer_phone,
                branchName: i.branch_name,
                isOverdue: i.status === 'Pending' && new Date(i.due_date) < new Date()
            })),
            totals: {
                count: installments.length,
                totalAmount,
                paidCount,
                pendingCount,
                overdueCount
            }
        };
    }

    // ========== UNIFIED DATA ENDPOINT ==========
    async getUnifiedReport(filter: ReportFilterDto) {
        const [general, cashBox, customers, loans, installments] = await Promise.all([
            this.getGeneralStats(filter),
            this.getCashBoxReport(filter),
            this.getCustomersReport(filter),
            this.getLoansReport(filter),
            this.getInstallmentsReport(filter)
        ]);

        return {
            general,
            cashBox,
            customers,
            loans,
            installments,
            generatedAt: new Date().toISOString()
        };
    }
}
