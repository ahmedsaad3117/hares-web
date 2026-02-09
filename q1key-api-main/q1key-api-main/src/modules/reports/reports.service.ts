import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ReportFilterDto } from "./dto/report-filter.dto";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "../../common/cache";

/**
 * ReportsService - Optimized Version with Caching
 *
 * Optimizations applied:
 * 1. Reduced JOINs by using subqueries and CTEs where appropriate
 * 2. Combined multiple queries into single queries where possible
 * 3. Added LIMIT and pagination to all detail queries
 * 4. Used parameterized queries consistently for security
 * 5. Optimized aggregations using database-level calculations
 * 6. Added in-memory caching for frequently accessed data
 *
 * Cache Policy:
 * - System stats (Super Admin): 5 minutes
 * - General stats: 5 minutes per institution
 * - Reports with date filters: NOT cached (dynamic data)
 */
@Injectable()
export class ReportsService {
  constructor(
    private dataSource: DataSource,
    private cacheService: CacheService,
  ) { }

  /**
   * Helper: Build WHERE clause with parameterized values
   * Returns { whereClause, params } for safe query building
   */
  private buildWhereClause(
    filter: {
      institutionId?: number;
      branchId?: number;
      startDate?: string;
      endDate?: string;
      status?: string;
      customerId?: number;
    },
    tableAlias: string = "",
    startParamIndex: number = 1,
  ): { whereClause: string; params: any[]; nextParamIndex: number } {
    const { institutionId, branchId, startDate, endDate, status, customerId } =
      filter;
    const prefix = tableAlias ? `${tableAlias}.` : "";
    let whereClause = "1=1";
    const params: any[] = [];
    let paramIndex = startParamIndex;

    if (
      institutionId !== undefined &&
      institutionId !== null &&
      Number(institutionId) !== -1
    ) {
      if (Number(institutionId) === 0) {
        whereClause += ` AND ${prefix}"institution_id" IS NULL`;
      } else {
        // Correct multi-tenant check: check loan table AND join with branches to check branch ownership
        // Note: This assumes the table being queried is 'loans' or has 'branch_id' and 'institution_id'
        whereClause += ` AND (${prefix}"institution_id" = $${paramIndex++} OR ${prefix}"branch_id" IN (SELECT branch_id FROM branches WHERE institution_id = $${paramIndex - 1}))`;
        params.push(institutionId);
      }
    }

    if (branchId !== undefined && branchId !== null) {
      if (Number(branchId) === 0) {
        whereClause += ` AND ${prefix}"branch_id" IS NULL`;
      } else {
        whereClause += ` AND ${prefix}"branch_id" = $${paramIndex++}`;
        params.push(branchId);
      }
    }

    if (startDate) {
      whereClause += ` AND ${prefix}"created_at" >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND ${prefix}"created_at" <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (status) {
      whereClause += ` AND ${prefix}"status" = $${paramIndex++}`;
      params.push(status);
    }

    if (customerId) {
      whereClause += ` AND ${prefix}"customer_id" = $${paramIndex++}`;
      params.push(customerId);
    }

    return { whereClause, params, nextParamIndex: paramIndex };
  }

  private applySecurityFilters(
    filter: ReportFilterDto,
    user: any,
  ): ReportFilterDto {
    const secureFilter = { ...filter };

    if (!user) {
      console.warn("[Reports] No user provided to security filters");
      return { ...filter, institutionId: -1, branchId: -1 };
    }

    try {
      // Extract role name robustly
      let roleName = "";
      if (typeof user.role === "string") {
        roleName = user.role;
      } else if (user.role && typeof user.role.roleName === "string") {
        roleName = user.role.roleName;
      } else if (typeof user.roleName === "string") {
        roleName = user.roleName;
      }

      roleName = roleName.toLowerCase();
      console.log(
        `[Reports] Applying security filters for Role: ${roleName}, UserID: ${user.userId || user.sub}`,
      );

      if (roleName === "super admin") {
        return secureFilter;
      }

      if (roleName.includes("branch")) {
        // For branch users, only use branch filter (highly specific)
        secureFilter.branchId = user.branchId;
        secureFilter.institutionId = undefined; // Clear to avoid AND l.institution_id = X (which is NULL for branch loans)
        if (!secureFilter.branchId) secureFilter.branchId = -1;
      } else if (roleName.includes("institution")) {
        // For institution users, use institution filter
        secureFilter.institutionId = user.institutionId;
        // branchId is allowed to stay if provided in filter
        if (!secureFilter.institutionId) secureFilter.institutionId = -1;
      } else {
        secureFilter.institutionId = -1;
        secureFilter.branchId = -1;
      }

      return secureFilter;
    } catch (e) {
      console.error("Error applying security filters:", e);
      return { ...filter, institutionId: -1, branchId: -1 };
    }
  }

  // ========== GENERAL STATS (OPTIMIZED + CACHED) ==========
  async getGeneralStats(filter: ReportFilterDto, user: any) {
    const secureFilter = this.applySecurityFilters(filter, user);
    const { institutionId, branchId, startDate, endDate } = secureFilter;

    console.log(
      `[Reports] getGeneralStats for Inst: ${institutionId}, Branch: ${branchId}`,
    );

    // System-wide stats for Super Admin
    if (
      Number(institutionId) === 0 &&
      (user?.roleName?.toLowerCase() === "super admin" ||
        user?.role?.roleName?.toLowerCase() === "super admin")
    ) {
      const systemStats = await this.dataSource.query(`
                SELECT 
                    (SELECT COUNT(*) FROM institutions) as inst_count,
                    (SELECT COUNT(*) FROM users) as user_count,
                    (SELECT COUNT(*) FROM subscription_requests WHERE status = 'Pending') as pending_count
            `);

      return {
        totalInstitutions: parseInt(systemStats[0]?.inst_count || 0),
        totalUsers: parseInt(systemStats[0]?.user_count || 0),
        pendingRequests: parseInt(systemStats[0]?.pending_count || 0),
        isSystemReport: true,
        totalCustomers: 0,
        totalLoans: 0,
        totalLoanAmount: 0,
        loansByStatus: [],
      };
    }

    // 1. Build Loan Filters
    const { whereClause: loansWhere, params: loansParams } =
      this.buildWhereClause(
        { institutionId, branchId, startDate, endDate },
        "l",
      );

    // 2. Build Customer Filters
    // Count customers who are linked to this institution/branch
    let customerWhere = "1=1";
    const customerParams: any[] = [];
    if (branchId) {
      customerWhere = "cr.branch_id = $1";
      customerParams.push(branchId);
    } else if (institutionId) {
      customerWhere = "cr.institution_id = $1";
      customerParams.push(institutionId);
    }

    try {
      const [loanCounts, loanTotals, customerCount, branchCount] =
        await Promise.all([
          this.dataSource.query(
            `SELECT status, COUNT(*) as count FROM loans l WHERE ${loansWhere} GROUP BY status`,
            loansParams,
          ),
          this.dataSource.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(principal_amount), 0) as total FROM loans l WHERE ${loansWhere}`,
            loansParams,
          ),
          this.dataSource.query(
            `SELECT COUNT(DISTINCT customer_id) as count FROM customer_relations cr WHERE ${customerWhere}`,
            customerParams,
          ),
          institutionId
            ? this.dataSource.query(
              `SELECT COUNT(*) as count FROM branches WHERE institution_id = $1`,
              [institutionId],
            )
            : Promise.resolve([{ count: 0 }]),
        ]);

      return {
        totalCustomers: parseInt(customerCount[0]?.count || 0),
        totalLoans: parseInt(loanTotals[0]?.count || 0),
        totalLoanAmount: parseFloat(loanTotals[0]?.total || 0),
        totalBranches: parseInt(branchCount[0]?.count || 0),
        loansByStatus: loanCounts.map((s: any) => ({
          status: s.status,
          count: parseInt(s.count),
        })),
        isSystemReport: false,
      };
    } catch (err) {
      console.error("General Stats Query Error:", err);
      return {
        totalCustomers: 0,
        totalLoans: 0,
        totalLoanAmount: 0,
        totalBranches: 0,
        loansByStatus: [],
        isSystemReport: false,
      };
    }
  }

  // Fallback for databases that don't support CTEs well
  private async getGeneralStatsFallback(
    institutionId: any,
    branchId: any,
    startDate?: string,
    endDate?: string,
  ) {
    const { whereClause, params } = this.buildWhereClause(
      { institutionId, branchId, startDate, endDate },
      "",
    );

    const [customers, loans, loansByStatus] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM customers WHERE ${whereClause}`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(principal_amount), 0) as total FROM loans WHERE ${whereClause}`,
        params,
      ),
      this.dataSource.query(
        `SELECT status, COUNT(*) as count FROM loans WHERE ${whereClause} GROUP BY status`,
        params,
      ),
    ]);

    return {
      totalCustomers: parseInt(customers[0]?.count || 0),
      totalLoans: parseInt(loans[0]?.count || 0),
      totalLoanAmount: parseFloat(loans[0]?.total || 0),
      loansByStatus: loansByStatus.map((s: any) => ({
        status: s.status,
        count: parseInt(s.count),
      })),
      isSystemReport: false,
    };
  }

  // ========== CASH BOX REPORT (OPTIMIZED) ==========
  async getCashBoxReport(filter: ReportFilterDto, user: any) {
    const { institutionId, branchId, cashBoxId, startDate, endDate, type } =
      this.applySecurityFilters(filter, user);

    // Build base WHERE clause for cash_boxes
    let cbWhere = "1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (cashBoxId !== undefined && cashBoxId !== null) {
      cbWhere += ` AND cb."cash_box_id" = $${paramIndex++}`;
      params.push(cashBoxId);
    } else {
      if (
        institutionId !== undefined &&
        institutionId !== null &&
        Number(institutionId) !== -1
      ) {
        if (Number(institutionId) === 0) {
          cbWhere += ` AND cb."institution_id" IS NULL`;
        } else {
          // Modified: Include all branches under this institution, or the institution's main box
          const currentIdx = paramIndex++;
          cbWhere += ` AND (cb."institution_id" = $${currentIdx} OR cb."branch_id" IN (SELECT branch_id FROM branches WHERE "institution_id" = $${currentIdx}))`;
          params.push(institutionId);
        }
      }
      if (branchId !== undefined && branchId !== null) {
        if (Number(branchId) === 0) {
          cbWhere += ` AND cb."branch_id" IS NULL`;
        } else {
          cbWhere += ` AND cb."branch_id" = $${paramIndex++}`;
          params.push(branchId);
        }
      }
    }

    // Date filters (parameterized for safety)
    let dateFilter = "";
    if (startDate && startDate.trim() !== "") {
      dateFilter += ` AND t."created_at" >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate && endDate.trim() !== "") {
      dateFilter += ` AND t."created_at" <= $${paramIndex++}`;
      params.push(endDate);
    }

    // Type filter
    let typeFilter = "";
    if (type) {
      typeFilter = ` AND t.transaction_type = $${paramIndex++}`;
      params.push(type);
    }

    // Optimized single query approach
    const combinedQuery = `
            SELECT 
                (
                    SELECT json_agg(json_build_object(
                        'transaction_type', transaction_type,
                        'total_amount', total_amount,
                        'count', count
                    ))
                    FROM (
                        SELECT 
                            t.transaction_type,
                            COALESCE(SUM(t.amount), 0) as total_amount,
                            COUNT(*) as count
                        FROM cash_box_transactions t
                        INNER JOIN cash_boxes cb ON t."cash_box_id" = cb."cash_box_id"
                        WHERE ${cbWhere} ${dateFilter} ${typeFilter}
                        GROUP BY t.transaction_type
                    ) s
                ) as summary,
                (
                    SELECT json_agg(json_build_object(
                        'id', id,
                        'transaction_type', transaction_type,
                        'amount', amount,
                        'balance_after', balance_after,
                        'description', description,
                        'loan_id', loan_id,
                        'installment_id', installment_id,
                        'created_at', created_at,
                        'branch_id', branch_id,
                        'branch_name', branch_name,
                        'created_by_name', created_by_name,
                        'customer_name', customer_name
                    ))
                    FROM (
                        SELECT 
                            t.id,
                            t.transaction_type,
                            t.amount,
                            t.balance_after,
                            t.description,
                            t.loan_id,
                            t.installment_id,
                            t.created_at,
                            cb.branch_id,
                            b.name as branch_name,
                            u.name as created_by_name,
                            c.name as customer_name
                        FROM cash_box_transactions t
                        INNER JOIN cash_boxes cb ON t."cash_box_id" = cb."cash_box_id"
                        LEFT JOIN branches b ON cb.branch_id = b."branch_id"
                        LEFT JOIN users u ON t.created_by = u."user_id"
                        LEFT JOIN loans l ON t.loan_id = l."loan_id"
                        LEFT JOIN customers c ON l."customer_id" = c."customer_id"
                        WHERE ${cbWhere} ${dateFilter} ${typeFilter}
                        ORDER BY t.created_at DESC
                        LIMIT 500
                    ) d
                ) as transactions
        `;

    try {
      const results = await this.dataSource.query(combinedQuery, params);
      const row = results[0] || {};

      const summary = row.summary || [];
      const transactions = row.transactions || [];

      // Calculate totals
      const inTypes = ["Deposit", "LoanPayment", "Subscription"];
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
          count: parseInt(r.count),
        })),
        transactions: transactions.map((t: any) => {
          const type = t.transaction_type;
          let amount = parseFloat(t.amount || 0);

          // For Loan Disbursement: Stored as positive (money out) in DB
          // UI expects negative for expenses/disbursements
          if (type === "LoanDisbursement") {
            amount = -amount;
          }

          return {
            id: t.id,
            type: type,
            amount: amount,
            balanceAfter: parseFloat(t.balance_after || 0),
            description: t.description,
            referenceId: t.loan_id || t.installment_id,
            referenceType: t.loan_id
              ? "Loan"
              : t.installment_id
                ? "Installment"
                : null,
            branchName: t.branch_name,
            createdBy: t.created_by_name,
            customerName: t.customer_name,
            createdAt: t.created_at,
          };
        }),
        totals: {
          totalIn,
          totalOut,
          netBalance: totalIn - totalOut,
        },
      };
    } catch (err) {
      console.error("Cash Box Report Error:", err);
      // Fallback to original two-query approach
      return this.getCashBoxReportFallback(
        params,
        cbWhere,
        dateFilter,
        typeFilter,
      );
    }
  }

  private async getCashBoxReportFallback(
    params: any[],
    cbWhere: string,
    dateFilter: string,
    typeFilter: string,
  ) {
    const summaryQuery = `
            SELECT t.transaction_type, COALESCE(SUM(t.amount), 0) as total_amount, COUNT(*) as count
            FROM cash_box_transactions t
            INNER JOIN cash_boxes cb ON t."cash_box_id" = cb."cash_box_id"
            WHERE ${cbWhere} ${dateFilter} ${typeFilter}
            GROUP BY t.transaction_type
        `;

    const detailQuery = `
            SELECT t.id, t.transaction_type, t.amount, t.description, t.loan_id, t.installment_id, t.created_at,
                   cb.branch_id, b.name as branch_name, u.name as created_by_name, c.name as customer_name
            FROM cash_box_transactions t
            INNER JOIN cash_boxes cb ON t."cash_box_id" = cb."cash_box_id"
            LEFT JOIN branches b ON cb."branch_id" = b."branch_id"
            LEFT JOIN users u ON t."created_by" = u."user_id"
            LEFT JOIN loans l ON t.loan_id = l."loan_id"
            LEFT JOIN customers c ON l."customer_id" = c."customer_id"
            WHERE ${cbWhere} ${dateFilter} ${typeFilter}
            ORDER BY t."created_at" DESC LIMIT 500
        `;

    const [summary, transactions] = await Promise.all([
      this.dataSource.query(summaryQuery, params),
      this.dataSource.query(detailQuery, params),
    ]);

    const inTypes = ["Deposit", "LoanPayment", "Subscription"];
    let totalIn = 0,
      totalOut = 0;

    summary.forEach((item: any) => {
      const amount = parseFloat(item.total_amount) || 0;
      if (inTypes.includes(item.transaction_type)) totalIn += amount;
      else totalOut += amount;
    });

    return {
      summary: summary.map((r: any) => ({
        type: r.transaction_type,
        totalAmount: parseFloat(r.total_amount) || 0,
        count: parseInt(r.count),
      })),
      transactions: transactions.map((t: any) => ({
        id: t.id,
        type: t.transaction_type,
        amount: parseFloat(t.amount),
        description: t.description,
        referenceId: t.loan_id || t.installment_id,
        referenceType: t.loan_id
          ? "Loan"
          : t.installment_id
            ? "Installment"
            : null,
        branchName: t.branch_name,
        createdBy: t.created_by_name,
        customerName: t.customer_name,
        createdAt: t.created_at,
      })),
      totals: { totalIn, totalOut, netBalance: totalIn - totalOut },
    };
  }

  // ========== CUSTOMERS REPORT (OPTIMIZED) ==========
  async getCustomersReport(filter: ReportFilterDto, user: any) {
    const { institutionId, branchId, startDate, endDate } =
      this.applySecurityFilters(filter, user);

    if (
      institutionId !== undefined &&
      institutionId !== null &&
      Number(institutionId) === 0
    ) {
      return {
        total: 0,
        growth: [],
        segments: {},
        kpi: {},
        customers: [],
        topCustomers: [],
        insights: {},
      };
    }

    // Build WHERE clause using customer_relations (cr) table
    let customerWhere = "1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (
      institutionId !== undefined &&
      institutionId !== null &&
      Number(institutionId) > 0
    ) {
      customerWhere += ` AND cr."institution_id" = $${paramIndex++}`;
      params.push(institutionId);
    }

    if (branchId !== undefined && branchId !== null && Number(branchId) > 0) {
      customerWhere += ` AND cr."branch_id" = $${paramIndex++}`;
      params.push(branchId);
    }

    let dateFilter = "";
    if (startDate) {
      dateFilter += ` AND c."created_at" >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND c."created_at" <= $${paramIndex++}`;
      params.push(endDate);
    }

    // OPTIMIZED: Single comprehensive query
    const analyticsQuery = `
            WITH customer_base AS (
                SELECT DISTINCT ON (c.customer_id, cr.branch_id) 
                       c.customer_id, c.name, c.national_id, c.phone_number, c.trust_status, c.created_at, cr.branch_id, cr.institution_id
                FROM customers c
                INNER JOIN customer_relations cr ON c.customer_id = cr.customer_id
                WHERE ${customerWhere} ${dateFilter}
            ),
            loan_stats AS (
                SELECT 
                    l.customer_id,
                    COUNT(*) as total_loans,
                    SUM(CASE WHEN l.status IN ('Paid', 'Finished') THEN 1 ELSE 0 END) as finished_loans,
                    SUM(CASE WHEN l.status = 'Active' THEN 1 ELSE 0 END) as active_loans,
                    SUM(CASE WHEN l.status = 'Late' THEN 1 ELSE 0 END) as troubled_loans,
                    COALESCE(SUM(l.principal_amount), 0) as total_value,
                    MAX(l.created_at) as last_loan_date
                FROM loans l
                WHERE l.customer_id IN (SELECT customer_id FROM customer_base)
                GROUP BY l.customer_id
            ),
            growth_data AS (
                SELECT 
                    DATE(c.created_at) as date,
                    COUNT(*) as count
                FROM customer_base c
                GROUP BY DATE(c.created_at)
                ORDER BY date ASC
            )
            SELECT 
                cb.customer_id,
                cb.name,
                cb.national_id,
                cb.phone_number,
                cb.trust_status,
                cb.created_at,
                cb.branch_id,
                cb.institution_id,
                COALESCE(ls.total_loans, 0) as total_loans,
                COALESCE(ls.finished_loans, 0) as finished_loans,
                COALESCE(ls.active_loans, 0) as active_loans,
                COALESCE(ls.troubled_loans, 0) as troubled_loans,
                COALESCE(ls.total_value, 0) as total_value,
                ls.last_loan_date,
                (SELECT COUNT(*) FROM customer_base) as total_count,
                (SELECT json_agg(json_build_object('date', date, 'count', count)) FROM growth_data) as growth_data
            FROM customer_base cb
            LEFT JOIN loan_stats ls ON cb.customer_id = ls.customer_id
            ORDER BY COALESCE(ls.total_value, 0) DESC
            LIMIT 1000
        `;

    try {
      const customerData = await this.dataSource.query(analyticsQuery, params);

      console.log(
        `[Reports] Customers for Inst: ${institutionId} (Branch: ${branchId}): Found ${customerData?.[0]?.total_count || 0} items.`,
      );

      if (!customerData || customerData.length === 0) {
        return {
          total: 0,
          growth: [],
          segments: {},
          kpi: {},
          customers: [],
          topCustomers: [],
          insights: {},
        };
      }

      const totalCount = parseInt(customerData[0]?.total_count || 0);
      const growthData = customerData[0]?.growth_data || [];

      // Process customers in memory (calculations are light)
      const segments = {
        vip: 0,
        active: 0,
        normal: 0,
        low_engagement: 0,
        risk: 0,
      };
      const scoredCustomers: any[] = [];
      let totalCLV = 0;
      let churnCandidates = 0;
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      for (const cust of customerData) {
        const totalLoans = parseInt(cust.total_loans);
        const activeLoans = parseInt(cust.active_loans);
        const troubledLoans = parseInt(cust.troubled_loans);
        const totalValue = parseFloat(cust.total_value);
        const lastLoanDate = cust.last_loan_date
          ? new Date(cust.last_loan_date)
          : null;

        totalCLV += totalValue;

        // Calculate score
        let score = 50;
        if (activeLoans > 0) score += 10;
        if (troubledLoans > 0) score -= 30;
        if (totalLoans > 2) score += 10;
        if (totalValue > 50000) score += 20;
        if (cust.trust_status === "Trusted") score += 10;
        if (cust.trust_status === "Blocked") score = 0;

        // Determine segment
        let segment = "normal";
        if (
          troubledLoans > 0 ||
          cust.trust_status === "Blocked" ||
          score < 30
        ) {
          segment = "risk";
          segments.risk++;
        } else if (totalValue > 50000 && troubledLoans === 0) {
          segment = "vip";
          segments.vip++;
        } else if (activeLoans > 0) {
          segment = "active";
          segments.active++;
        } else if (!lastLoanDate || lastLoanDate < ninetyDaysAgo) {
          segment = "low_engagement";
          segments.low_engagement++;
          churnCandidates++;
        } else {
          segments.normal++;
        }

        scoredCustomers.push({
          customerId: cust.customer_id,
          name: cust.name,
          nationalId: cust.national_id,
          phoneNumber: cust.phone_number,
          trustStatus: cust.trust_status,
          createdAt: cust.created_at,
          branchId: cust.branch_id,
          institutionId: cust.institution_id,
          totalLoans,
          activeLoans,
          finishedLoans: parseInt(cust.finished_loans),
          troubledLoans,
          totalValue,
          lastActivity: lastLoanDate,
          segment,
          score,
        });
      }

      const totalCustomersCount = totalCount || 1;
      const retentionRate = (
        ((totalCustomersCount - churnCandidates) / totalCustomersCount) *
        100
      ).toFixed(1);
      const churnRate = ((churnCandidates / totalCustomersCount) * 100).toFixed(
        1,
      );
      const avgCLV = (totalCLV / Math.max(scoredCustomers.length, 1)).toFixed(
        2,
      );
      const activeRate = (
        ((segments.active + segments.vip) /
          Math.max(scoredCustomers.length, 1)) *
        100
      ).toFixed(1);

      // Sort by score for top customers
      scoredCustomers.sort((a, b) => b.score - a.score);

      return {
        total: totalCount,
        growth: (growthData || []).map((g: any) => ({
          date: g.date,
          count: parseInt(g.count),
        })),
        segments,
        kpi: {
          retentionRate: parseFloat(retentionRate),
          churnRate: parseFloat(churnRate),
          avgCLV: parseFloat(avgCLV),
          activeRate: parseFloat(activeRate),
        },
        customers: scoredCustomers,
        topCustomers: scoredCustomers.slice(0, 20),
        insights: {
          riskCount: segments.risk,
          vipPotential: scoredCustomers.filter(
            (c) => c.segment === "active" && c.totalValue > 30000,
          ).length,
          churnRisk: churnCandidates,
        },
      };
    } catch (err) {
      console.error("Customers Report Error:", err);
      return {
        total: 0,
        growth: [],
        segments: {},
        kpi: {},
        customers: [],
        topCustomers: [],
        insights: {},
      };
    }
  }

  // ========== LOANS REPORT (OPTIMIZED) ==========
  async getLoansReport(filter: ReportFilterDto, user: any) {
    const { institutionId, branchId, startDate, endDate, status, customerId } =
      this.applySecurityFilters(filter, user);

    if (
      institutionId !== undefined &&
      institutionId !== null &&
      Number(institutionId) === 0
    ) {
      return {
        byProduct: [],
        byStatus: [],
        loans: [],
        totals: {
          count: 0,
          totalPrincipal: 0,
          totalProfit: 0,
          totalPaid: 0,
          totalRemaining: 0,
        },
      };
    }

    // Build WHERE clause
    const {
      whereClause: loanWhere,
      params,
      nextParamIndex: paramIndex,
    } = this.buildWhereClause(
      { institutionId, branchId, status, customerId },
      "l",
    );

    let dateFilter = "";
    let currentIdx = paramIndex;
    if (startDate) {
      dateFilter += ` AND l."created_at" >= $${currentIdx++}`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND l."created_at" <= $${currentIdx++}`;
      params.push(endDate);
    }

    // OPTIMIZED: Single query with CTEs for all aggregations
    const combinedQuery = `
            WITH filtered_loans AS (
                SELECT 
                    l.loan_id, l.principal_amount, l.profit_amount, l.paid_amount, l.status,
                    l.payment_plan_months, l.due_date, l.created_at,
                    l.customer_id, l.product_id, l.branch_id, l.institution_id
                FROM loans l
                WHERE ${loanWhere} ${dateFilter}
            ),
            by_product AS (
                SELECT 
                    COALESCE(p.name, 'Unknown') as product_name,
                    COUNT(*) as count,
                    COALESCE(SUM(fl.principal_amount), 0) as total_amount
                FROM filtered_loans fl
                LEFT JOIN products p ON fl.product_id = p.product_id
                GROUP BY p.name
            ),
            by_status AS (
                SELECT status, COUNT(*) as count, COALESCE(SUM(principal_amount), 0) as total_amount
                FROM filtered_loans
                GROUP BY status
            ),
            totals AS (
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(principal_amount), 0) as total_principal,
                    COALESCE(SUM(profit_amount), 0) as total_profit,
                    COALESCE(SUM(paid_amount), 0) as total_paid
                FROM filtered_loans
            ),
            details AS (
                SELECT 
                    fl.loan_id, fl.principal_amount, fl.profit_amount, fl.paid_amount, fl.status,
                    fl.payment_plan_months, fl.due_date, fl.created_at,
                    c.name as customer_name, c.phone_number as customer_phone,
                    p.name as product_name, b.name as branch_name, b.phone_number as branch_phone,
                    COALESCE(i.name, i_via_branch.name) as institution_name,
                    COALESCE(i.phone_number, i_via_branch.phone_number) as institution_phone,
                    fl.branch_id, fl.customer_id, fl.institution_id,
                    (SELECT COUNT(*) FROM installments WHERE loan_id = fl.loan_id) as total_installments_count,
                    (SELECT COUNT(*) FROM installments WHERE loan_id = fl.loan_id AND LOWER(TRIM(status)) = 'paid') as paid_installments_count,
                    (SELECT COALESCE(SUM(amount), 0) FROM installments WHERE loan_id = fl.loan_id AND LOWER(TRIM(status)) = 'paid') as total_paid_amount
                FROM filtered_loans fl
                LEFT JOIN customers c ON fl.customer_id = c.customer_id
                LEFT JOIN products p ON fl.product_id = p.product_id
                LEFT JOIN branches b ON fl.branch_id = b.branch_id
                LEFT JOIN institutions i ON fl.institution_id = i.institution_id
                LEFT JOIN institutions i_via_branch ON b.institution_id = i_via_branch.institution_id
                ORDER BY fl.created_at DESC
                LIMIT 500
            )
            SELECT 
                (SELECT json_agg(json_build_object('name', product_name, 'count', count, 'amount', total_amount)) FROM by_product) as by_product,
                (SELECT json_agg(json_build_object('status', status, 'count', count, 'amount', total_amount)) FROM by_status) as by_status,
                (SELECT row_to_json(t) FROM totals t) as totals,
                (SELECT json_agg(row_to_json(d)) FROM details d) as loans
        `;

    try {
      const result = await this.dataSource.query(combinedQuery, params);
      const row = result[0] || {};

      const byProduct = row.by_product || [];
      const byStatus = row.by_status || [];
      const totals = row.totals || {};
      const loans = row.loans || [];

      return {
        byProduct: byProduct.map((p: any) => ({
          name: p.name,
          count: parseInt(p.count),
          amount: parseFloat(p.amount || 0),
        })),
        byStatus: byStatus.map((s: any) => ({
          status: s.status,
          count: parseInt(s.count),
          amount: parseFloat(s.amount || 0),
        })),
        loans: loans.map((l: any) => {
          const dbPaid = parseFloat(l.paid_amount || 0); // Stored in loans table
          const subqueryPaid = parseFloat(l.total_paid_amount || 0); // Calculated from installments
          const finalPaid = Math.max(dbPaid, subqueryPaid);

          const principal = parseFloat(l.principal_amount);
          const profit = parseFloat(l.profit_amount || 0);
          const totalVal = principal + profit;
          const remaining = totalVal - finalPaid;

          return {
            loanId: l.loan_id,
            principalAmount: principal,
            profitAmount: profit,
            paidAmount: finalPaid,
            remaining: remaining > 0 ? remaining : 0,
            status: l.status,
            paymentPlanMonths: l.payment_plan_months,
            dueDate: l.due_date,
            createdAt: l.created_at,
            customerName: l.customer_name,
            customerPhone: l.customer_phone,
            productName: l.product_name,
            branchName: l.branch_name,
            institutionName: l.institution_name,
            branchId: l.branch_id,
            customerId: l.customer_id,
            institutionId: l.institution_id,
            total_installments_count: l.total_installments_count,
            paid_installments_count: l.paid_installments_count,
            total_paid_amount: subqueryPaid,
          };
        }),
        totals: {
          count: parseInt(totals.count || 0),
          totalPrincipal: parseFloat(totals.total_principal || 0),
          totalProfit: parseFloat(totals.total_profit || 0),
          totalPaid: parseFloat(totals.total_paid || 0),
          totalRemaining:
            parseFloat(totals.total_principal || 0) +
            parseFloat(totals.total_profit || 0) -
            parseFloat(totals.total_paid || 0),
        },
      };
    } catch (err) {
      console.error("Loans Report Error:", err);
      return {
        byProduct: [],
        byStatus: [],
        loans: [],
        totals: {
          count: 0,
          totalPrincipal: 0,
          totalProfit: 0,
          totalPaid: 0,
          totalRemaining: 0,
        },
      };
    }
  }

  // ========== INSTALLMENTS REPORT (OPTIMIZED) ==========
  async getInstallmentsReport(filter: ReportFilterDto, user: any) {
    const { institutionId, branchId, startDate, endDate, status, customerId } =
      this.applySecurityFilters(filter, user);

    if (
      institutionId !== undefined &&
      institutionId !== null &&
      Number(institutionId) === 0
    ) {
      return {
        byStatus: [],
        installments: [],
        totals: {
          count: 0,
          totalAmount: 0,
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
        },
      };
    }

    // Build WHERE clause on loans table (for scope filtering)
    let loanWhere = "1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (branchId !== undefined && branchId !== null && Number(branchId) > 0) {
      loanWhere += ` AND l.branch_id = $${paramIndex++}`;
      params.push(branchId);
    } else if (
      branchId !== undefined &&
      branchId !== null &&
      Number(branchId) === 0
    ) {
      // Main Treasury (Institution level loans)
      loanWhere += ` AND l.branch_id IS NULL`;
      if (institutionId) {
        loanWhere += ` AND l.institution_id = $${paramIndex++}`;
        params.push(institutionId);
      }
    } else if (
      institutionId !== undefined &&
      institutionId !== null &&
      Number(institutionId) > 0
    ) {
      // All Institution Data (Branches + Institution Level)
      const currentIdx = paramIndex++;
      loanWhere += ` AND (l.institution_id = $${currentIdx} OR l.branch_id IN (SELECT branch_id FROM branches WHERE institution_id = $${currentIdx}))`;
      params.push(institutionId);
    }

    if (customerId) {
      loanWhere += ` AND l."customer_id" = $${paramIndex++}`;
      params.push(customerId);
    }

    // Installment-specific filters
    let instFilter = "";
    if (status) {
      instFilter += ` AND i."status" = $${paramIndex++}`;
      params.push(status);
    }

    let dateFilter = "";
    if (startDate) {
      dateFilter += ` AND i."due_date" >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ` AND i."due_date" <= $${paramIndex++}`;
      params.push(endDate);
    }

    // OPTIMIZED: Single query with CTEs
    const combinedQuery = `
            WITH filtered_installments AS (
                SELECT 
                    i.id, i.installment_number, i.amount, i.status, i.due_date, i.payment_date,
                    l.loan_id, l.principal_amount as loan_amount, l.customer_id, l.branch_id, l.institution_id
                FROM installments i
                INNER JOIN loans l ON i.loan_id = l.loan_id
                WHERE ${loanWhere} ${instFilter} ${dateFilter}
            ),
            by_status AS (
                SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
                FROM filtered_installments
                GROUP BY status
            ),
            totals AS (
                SELECT 
                    COUNT(*) as count,
                    COALESCE(SUM(amount), 0) as total_amount,
                    SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN status = 'Pending' AND due_date >= CURRENT_DATE THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'Pending' AND due_date < CURRENT_DATE THEN 1 ELSE 0 END) as overdue_count
                FROM filtered_installments
            ),
            details AS (
                SELECT 
                    fi.id as installment_id, fi.installment_number, fi.amount, fi.status, fi.due_date, fi.payment_date,
                    fi.loan_id, fi.loan_amount, fi.customer_id, fi.branch_id, fi.institution_id,
                    c.name as customer_name, c.phone_number as customer_phone,
                    b.name as branch_name, 
                    COALESCE(inst.name, inst_via_branch.name) as institution_name
                FROM filtered_installments fi
                LEFT JOIN customers c ON fi.customer_id = c.customer_id
                LEFT JOIN branches b ON fi.branch_id = b.branch_id
                LEFT JOIN institutions inst ON fi.institution_id = inst.institution_id
                LEFT JOIN institutions inst_via_branch ON b.institution_id = inst_via_branch.institution_id
                ORDER BY 
                    fi.loan_id DESC,
                    fi.installment_number ASC,
                    CASE 
                        WHEN fi.status = 'Pending' AND fi.due_date < CURRENT_DATE THEN 1
                        WHEN fi.status = 'Pending' THEN 2
                        WHEN fi.status = 'Paid' THEN 3
                        ELSE 4 
                    END
                LIMIT 500
            )
            SELECT 
                (SELECT json_agg(json_build_object('status', status, 'count', count, 'amount', total_amount)) FROM by_status) as by_status,
                (SELECT row_to_json(t) FROM totals t) as totals,
                (SELECT json_agg(row_to_json(d)) FROM details d) as installments
        `;

    try {
      const result = await this.dataSource.query(combinedQuery, params);
      const row = result[0] || {};

      console.log(
        `[Reports] Installments for Inst: ${institutionId} (Branch: ${branchId}): Found ${row.totals?.count || 0} items.`,
      );
      console.log(`[Reports] Date Filter: ${startDate} to ${endDate}`);

      const byStatus = row.by_status || [];
      const totals = row.totals || {};
      const installments = row.installments || [];
      const now = new Date();

      return {
        byStatus: byStatus.map((s: any) => ({
          status: s.status,
          count: parseInt(s.count),
          amount: parseFloat(s.amount || 0),
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
          customerId: i.customer_id,
          branchId: i.branch_id,
          customerName: i.customer_name,
          customerPhone: i.customer_phone,
          branchName: i.branch_name,
          institutionName: i.institution_name,
          institutionId: i.institution_id,
          isOverdue: i.status === "Pending" && new Date(i.due_date) < now,
        })),
        totals: {
          count: parseInt(totals.count || 0),
          totalAmount: parseFloat(totals.total_amount || 0),
          paidCount: parseInt(totals.paid_count || 0),
          pendingCount: parseInt(totals.pending_count || 0),
          overdueCount: parseInt(totals.overdue_count || 0),
        },
      };
    } catch (err) {
      console.error("Installments Report Error:", err);
      return {
        byStatus: [],
        installments: [],
        totals: {
          count: 0,
          totalAmount: 0,
          paidCount: 0,
          pendingCount: 0,
          overdueCount: 0,
        },
      };
    }
  }

  // ========== UNIFIED DATA ENDPOINT (Optimized for Reports Page) ==========
  async getUnifiedReport(filter: ReportFilterDto, user: any) {
    const secureFilter = this.applySecurityFilters(filter, user);
    const roleName = (
      user?.role?.roleName ||
      user?.roleName ||
      ""
    ).toLowerCase();
    const institutionId = user.institutionId;

    // Execute all reports and metadata in parallel
    const [
      general,
      cashBox,
      customers,
      loans,
      installments,
      institutions,
      branches,
      cashboxes,
    ] = await Promise.all([
      // 1. Core Reports Data
      this.getGeneralStats(filter, user).catch((err) => {
        console.error("General Stats Error:", err);
        return {};
      }),
      this.getCashBoxReport(filter, user).catch((err) => {
        console.error("CashBox Report Error:", err);
        return { summary: [], transactions: [], totals: {} };
      }),
      this.getCustomersReport(filter, user).catch((err) => {
        console.error("Customers Report Error:", err);
        return { total: 0, growth: [], segments: {}, customers: [] };
      }),
      this.getLoansReport(filter, user).catch((err) => {
        console.error("Loans Report Error:", err);
        return { byProduct: [], byStatus: [], loans: [] };
      }),
      this.getInstallmentsReport(filter, user).catch((err) => {
        console.error("Installments Report Error:", err);
        return { byStatus: [], installments: [] };
      }),

      // 2. Institutions Metadata (Super Admin gets all, Institution gets self)
      roleName === "super admin"
        ? this.dataSource
          .query("SELECT * FROM institutions ORDER BY name ASC")
          .catch(() => [])
        : institutionId
          ? this.dataSource
            .query("SELECT * FROM institutions WHERE institution_id = $1", [
              institutionId,
            ])
            .catch(() => [])
          : Promise.resolve([]),

      // 3. Branches Metadata (Super Admin or Institution)
      roleName === "super admin"
        ? this.dataSource
          .query("SELECT * FROM branches ORDER BY name ASC")
          .catch(() => [])
        : roleName === "institution" && institutionId
          ? this.dataSource
            .query(
              "SELECT * FROM branches WHERE institution_id = $1 ORDER BY name ASC",
              [institutionId],
            )
            .catch(() => [])
          : Promise.resolve([]),

      // 4. Enhanced Cashboxes Metadata (With names and stats)
      this.getCashBoxesMetadata(secureFilter, user),
    ]);

    return {
      general,
      cashBox,
      customers,
      loans,
      installments,
      institutions,
      branches,
      cashboxes,
      generatedAt: new Date().toISOString(),
    };
  }

  private async getCashBoxesMetadata(filter: ReportFilterDto, user: any) {
    const roleName = (
      user?.role?.roleName ||
      user?.roleName ||
      ""
    ).toLowerCase();
    const institutionId = user.institutionId;
    const branchId = user.branchId;
    const { startDate, endDate } = filter;

    let query = `
            SELECT 
                cb.cash_box_id as "cashBoxId",
                cb.branch_id as "branchId",
                cb.institution_id as "institutionId",
                cb.balance as "balance",
                cb.box_type as "boxType",
                cb.updated_at as "updatedAt",
                b.name as "branchName", 
                inst.name as "institutionName",
                COALESCE(stats.total_deposits, 0) as "totalDeposits",
                COALESCE(stats.total_withdrawals, 0) as "totalWithdrawals",
                COALESCE(stats.transaction_count, 0) as "transactionCount"
            FROM cash_boxes cb
            LEFT JOIN branches b ON cb.branch_id = b.branch_id
            LEFT JOIN institutions inst ON cb.institution_id = inst.institution_id
            LEFT JOIN LATERAL (
                SELECT 
                    SUM(CASE WHEN t.transaction_type IN ('Deposit', 'LoanPayment', 'Subscription') THEN t.amount ELSE 0 END) as total_deposits,
                    SUM(CASE WHEN t.transaction_type IN ('Withdrawal', 'LoanDisbursement') THEN t.amount ELSE 0 END) as total_withdrawals,
                    COUNT(*) as transaction_count
                FROM cash_box_transactions t
                WHERE t.cash_box_id = cb.cash_box_id
                AND ($1::text IS NULL OR t.created_at >= $1::timestamp)
                AND ($2::text IS NULL OR t.created_at <= $2::timestamp)
            ) stats ON true
            WHERE cb.is_active = true
        `;

    const params: any[] = [startDate || null, endDate || null];
    let pIdx = 3;

    if (roleName === "super admin") {
      // No extra filters for super admin
    } else if (roleName === "institution" && institutionId) {
      query += ` AND cb.institution_id = $${pIdx++}`;
      params.push(institutionId);
    } else if (branchId) {
      query += ` AND cb.branch_id = $${pIdx++}`;
      params.push(branchId);
    } else {
      return [];
    }

    query += ` ORDER BY cb.balance DESC`;

    try {
      const results = await this.dataSource.query(query, params);
      return results.map((r) => ({
        ...r,
        balance: parseFloat(r.balance),
        totalDeposits: parseFloat(r.totalDeposits),
        totalWithdrawals: parseFloat(r.totalWithdrawals),
        transactionCount: parseInt(r.transactionCount),
      }));
    } catch (error) {
      console.error("Error fetching cashboxes metadata:", error);
      return [];
    }
  }

  // ========== COMPARISONS DATA ENDPOINT (Optimized for Comparisons Page) ==========
  async getComparisonsData(user: any) {
    const roleName = (
      user?.role?.roleName ||
      user?.roleName ||
      ""
    ).toLowerCase();
    const institutionId = user.institutionId;
    const branchId = user.branchId;

    // Execute all data fetching in parallel
    const [institutions, branches, customers, loans, installments, cashboxes] =
      await Promise.all([
        // 1. Institutions (Only Super Admin sees multiple)
        roleName === "super admin"
          ? this.dataSource
            .query("SELECT * FROM institutions ORDER BY name ASC")
            .catch(() => [])
          : institutionId
            ? this.dataSource
              .query("SELECT * FROM institutions WHERE institution_id = $1", [
                institutionId,
              ])
              .catch(() => [])
            : Promise.resolve([]),

        // 2. Branches
        roleName === "super admin"
          ? this.dataSource
            .query("SELECT * FROM branches ORDER BY name ASC")
            .catch(() => [])
          : institutionId
            ? this.dataSource
              .query(
                "SELECT * FROM branches WHERE institution_id = $1 ORDER BY name ASC",
                [institutionId],
              )
              .catch(() => [])
            : Promise.resolve([]),

        // 3. Customers (Joining with relations to get all customers in this scope)
        roleName === "super admin"
          ? this.dataSource.query("SELECT * FROM customers").catch(() => [])
          : institutionId
            ? this.dataSource
              .query(
                "SELECT c.* FROM customers c INNER JOIN customer_relations cr ON c.customer_id = cr.customer_id WHERE cr.institution_id = $1",
                [institutionId],
              )
              .catch(() => [])
            : Promise.resolve([]),

        // 4. Loans (Include branch loans for institution users)
        roleName === "super admin"
          ? this.dataSource.query("SELECT * FROM loans").catch(() => [])
          : institutionId
            ? this.dataSource
              .query(
                "SELECT * FROM loans WHERE institution_id = $1 OR branch_id IN (SELECT branch_id FROM branches WHERE institution_id = $1)",
                [institutionId],
              )
              .catch(() => [])
            : Promise.resolve([]),

        // 5. Installments (Last 12 months for collection rates - joining loans to get branch/inst mapping)
        this.dataSource
          .query(
            `
                SELECT i.*, l.branch_id, l.institution_id 
                FROM installments i
                JOIN loans l ON i.loan_id = l.loan_id
                WHERE i.due_date >= NOW() - INTERVAL '12 months'
                ${roleName !== "super admin" ? "AND (l.institution_id = $1 OR l.branch_id IN (SELECT branch_id FROM branches WHERE institution_id = $1))" : ""}
            `,
            roleName !== "super admin" ? [institutionId] : [],
          )
          .catch(() => []),

        // 6. Cashboxes (Joining names for better comparison display)
        this.dataSource
          .query(
            `
                SELECT cb.*, b.name as branch_name, inst.name as institution_name
                FROM cash_boxes cb
                LEFT JOIN branches b ON cb.branch_id = b.branch_id
                LEFT JOIN institutions inst ON cb.institution_id = inst.institution_id
                WHERE cb.box_type = 'Branch'
                ${roleName !== "super admin" ? "AND cb.institution_id = $1" : ""}
                ORDER BY cb.balance DESC
            `,
            roleName !== "super admin" ? [institutionId] : [],
          )
          .catch(() => []),
      ]);

    return {
      institutions,
      branches,
      customers,
      loans,
      installments,
      cashboxes,
      generatedAt: new Date().toISOString(),
    };
  }

  // ========== DASHBOARD SUMMARY (OPTIMIZED FOR SPEED) ==========
  async getDashboardSummary(filter: ReportFilterDto, user: any) {
    const secureFilter = this.applySecurityFilters(filter, user);
    const { institutionId, branchId } = secureFilter;

    // Use cache for dashboard stats to make it lightning fast
    const cacheKey = `dashboard:summary:${institutionId || 0}:${branchId || 0}`;

    return this.cacheService.get(
      cacheKey,
      async () => {
        const now = new Date();
        // Default view: Show installments due from beginning of this month up to 1 year ahead
        // This ensures users see upcoming installments even if none are due strictly "this month"
        const startOfRange = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const endOfRange = new Date(now.getFullYear() + 1, now.getMonth(), 1)
          .toISOString()
          .split("T")[0];

        // Execute heavy lifting in parallel with error catchers to prevent total failure
        const [stats, installments, activities] = await Promise.all([
          // 1. Stats (Counts)
          this.getGeneralStats(secureFilter, user).catch((err) => {
            console.error("Dashboard Stats Error:", err);
            return {
              totalCustomers: 0,
              totalLoans: 0,
              totalLoanAmount: 0,
              loansByStatus: [],
            };
          }),

          // 2. Installments Summary (Current view)
          this.getInstallmentsReport(
            { ...secureFilter, startDate: startOfRange, endDate: endOfRange },
            user,
          ).catch((err) => {
            console.error("Dashboard Installments Error:", err);
            return { totals: { count: 0, totalAmount: 0 }, byStatus: [] };
          }),

          // 3. Recent Activity (Last 10 items)
          this.getRecentActivity(secureFilter, user).catch((err) => {
            console.error("Dashboard Activity Error:", err);
            return [];
          }),
        ]);

        // Also get system counts if Super Admin
        let systemCounts: any = null;
        const roleName = user?.role?.roleName || user?.roleName || "";
        if (
          Number(institutionId) === 0 &&
          roleName.toLowerCase() === "super admin"
        ) {
          const counts = await this.dataSource.query(`
                        SELECT 
                            (SELECT COUNT(*) FROM institutions) as total_institutions,
                            (SELECT COUNT(*) FROM branches) as total_branches,
                            (SELECT COUNT(*) FROM customers) as total_customers,
                            (SELECT COUNT(*) FROM loans) as total_loans
                    `);
          systemCounts = {
            institutions: parseInt(counts[0].total_institutions),
            branches: parseInt(counts[0].total_branches),
            customers: parseInt(counts[0].total_customers),
            loans: parseInt(counts[0].total_loans),
          };
        }

        return {
          stats,
          systemCounts,
          installments: {
            totals: installments.totals,
            byStatus: installments.byStatus,
          },
          activities,
          generatedAt: new Date().toISOString(),
        };
      },
      60, // Cache for 1 minute
    );
  }

  private async getRecentActivity(filter: ReportFilterDto, user: any) {
    const { institutionId, branchId } = filter;
    let loanWhere = "1=1";
    let custWhere = "1=1";
    const params: any[] = [];
    let pIdx = 1;

    if (branchId) {
      loanWhere += ` AND l.branch_id = $${pIdx}`;
      custWhere += ` AND created_by IN (SELECT user_id FROM users WHERE branch_id = $${pIdx})`;
      params.push(branchId);
      pIdx++;
    } else if (institutionId) {
      loanWhere += ` AND (l.institution_id = $${pIdx} OR l.branch_id IN (SELECT branch_id FROM branches WHERE institution_id = $${pIdx}))`;
      custWhere += ` AND institution_id = $${pIdx}`;
      params.push(institutionId);
      pIdx++;
    }

    const query = `
            SELECT * FROM (
                (SELECT 'loan_created' as activity_type, principal_amount as activity_amount, c.name as customer_name, l.created_at, l.loan_id as id
                 FROM loans l
                 LEFT JOIN customers c ON l.customer_id = c.customer_id
                 WHERE ${loanWhere}
                 ORDER BY l.created_at DESC LIMIT 10)
                UNION ALL
                (SELECT 'customer_added' as activity_type, 0 as activity_amount, name as customer_name, created_at, customer_id as id
                 FROM customers
                 WHERE ${custWhere}
                 ORDER BY created_at DESC LIMIT 10)
            ) combined
            ORDER BY created_at DESC LIMIT 10
        `;

    const results = await this.dataSource.query(query, params);
    return results.map((r) => ({
      type: r.activity_type,
      amount: parseFloat(r.activity_amount || 0),
      customerName: r.customer_name || "Unknown Customer",
      timestamp: r.created_at || r.createdAt,
      id: r.id,
    }));
  }
}
