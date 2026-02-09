// Reports Engine - محرك التقارير المشترك
// يوفر وظائف مشتركة لجميع صفحات التقارير والمقارنات

class ReportsEngine {
    constructor() {
        this.currentUser = null;
        this.rawData = {
            loans: [],
            installments: [],
            customers: [],
            branches: [],
            institutions: [],
            funds: []
        };
    }

    // تهيئة المحرك
    async initialize() {
        this.currentUser = getCurrentUser();
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }
        await this.loadAllData();
    }

    // تحميل جميع البيانات حسب صلاحيات المستخدم
    async loadAllData() {
        if (this.currentUser.roleName === 'Super Admin') {
            await this.loadAdminData();
        } else if (this.currentUser.roleName === 'Institution') {
            await this.loadInstitutionData();
        } else if (this.currentUser.roleName === 'Branch') {
            await this.loadBranchData();
        }
    }

    // تحميل بيانات الأدمن (كل شيء)
    async loadAdminData() {
        // تحميل كل القروض
        const loansResponse = await api.loans.getAll(1, 10000);
        this.rawData.loans = loansResponse.data || [];

        // تحميل الأقساط
        const installmentPromises = this.rawData.loans.map(loan =>
            api.loans.getInstallments(loan.loanId).then(insts =>
                insts.map(inst => ({ ...inst, loan, customer: loan.customer, branch: loan.branch }))
            )
        );
        const installmentResults = await Promise.all(installmentPromises);
        this.rawData.installments = installmentResults.flat();

        // تحميل العملاء
        const customersResponse = await api.customers.getAll(1, 10000);
        this.rawData.customers = customersResponse.data || [];

        // تحميل المؤسسات
        const institutionsResponse = await api.institutions.getAll(1, 1000);
        this.rawData.institutions = institutionsResponse.data || [];

        // تحميل الفروع
        const branchesResponse = await api.branches.getAll(1, 1000);
        this.rawData.branches = branchesResponse.data || [];
    }

    // تحميل بيانات المؤسسة
    async loadInstitutionData() {
        const loansResponse = await api.loans.getAll(1, 10000);
        this.rawData.loans = (loansResponse.data || []).filter(loan =>
            loan.institutionId === this.currentUser.institutionId
        );

        const installmentPromises = this.rawData.loans.map(loan =>
            api.loans.getInstallments(loan.loanId).then(insts =>
                insts.map(inst => ({ ...inst, loan, customer: loan.customer, branch: loan.branch }))
            )
        );
        const installmentResults = await Promise.all(installmentPromises);
        this.rawData.installments = installmentResults.flat();

        const customersResponse = await api.customers.getAll(1, 10000);
        this.rawData.customers = customersResponse.data || [];

        const branchesResponse = await api.branches.getAll(1, 1000);
        this.rawData.branches = (branchesResponse.data || []).filter(branch =>
            branch.institutionId === this.currentUser.institutionId
        );
    }

    // تحميل بيانات الفرع
    async loadBranchData() {
        const loansResponse = await api.loans.getAll(1, 10000);
        this.rawData.loans = (loansResponse.data || []).filter(loan =>
            loan.branchId === this.currentUser.branchId
        );

        const installmentPromises = this.rawData.loans.map(loan =>
            api.loans.getInstallments(loan.loanId).then(insts =>
                insts.map(inst => ({ ...inst, loan, customer: loan.customer, branch: loan.branch }))
            )
        );
        const installmentResults = await Promise.all(installmentPromises);
        this.rawData.installments = installmentResults.flat();

        const customersResponse = await api.customers.getAll(1, 10000);
        this.rawData.customers = customersResponse.data || [];
    }

    // فلترة البيانات حسب الفترة الزمنية
    filterByPeriod(period, startDate = null, endDate = null) {
        const now = new Date();
        let start, end = now;

        if (period === 'custom' && startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
        } else {
            switch (period) {
                case 'today':
                    start = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'yesterday':
                    start = new Date(now.setDate(now.getDate() - 1));
                    start.setHours(0, 0, 0, 0);
                    end = new Date(start);
                    end.setHours(23, 59, 59, 999);
                    break;
                case 'week':
                    start = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    start = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                case 'quarter':
                    start = new Date(now.setMonth(now.getMonth() - 3));
                    break;
                case 'year':
                    start = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    start = new Date(0);
            }
        }

        return {
            loans: this.rawData.loans.filter(loan =>
                new Date(loan.createdAt) >= start && new Date(loan.createdAt) <= end
            ),
            installments: this.rawData.installments.filter(inst =>
                new Date(inst.dueDate) >= start && new Date(inst.dueDate) <= end
            ),
            customers: this.rawData.customers,
            branches: this.rawData.branches,
            institutions: this.rawData.institutions
        };
    }

    // حساب إحصائيات القروض
    calculateLoanStats(loans) {
        const total = loans.length;
        const totalAmount = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
        const active = loans.filter(l => l.status === 'Active').length;
        const completed = loans.filter(l => l.status === 'Completed').length;
        const defaulted = loans.filter(l => l.status === 'Defaulted').length;

        return {
            total,
            totalAmount,
            active,
            completed,
            defaulted,
            averageAmount: total > 0 ? totalAmount / total : 0,
            completionRate: total > 0 ? (completed / total) * 100 : 0,
            defaultRate: total > 0 ? (defaulted / total) * 100 : 0
        };
    }

    // حساب إحصائيات الأقساط
    calculateInstallmentStats(installments) {
        const total = installments.length;
        const paid = installments.filter(i => i.status === 'Paid');
        const pending = installments.filter(i => i.status === 'Pending');
        const overdue = installments.filter(i => i.status === 'Overdue');

        const totalAmount = installments.reduce((sum, i) => sum + (i.amount || 0), 0);
        const paidAmount = paid.reduce((sum, i) => sum + (i.amount || 0), 0);
        const pendingAmount = pending.reduce((sum, i) => sum + (i.amount || 0), 0);
        const overdueAmount = overdue.reduce((sum, i) => sum + (i.amount || 0), 0);

        return {
            total,
            totalAmount,
            paid: paid.length,
            paidAmount,
            pending: pending.length,
            pendingAmount,
            overdue: overdue.length,
            overdueAmount,
            collectionRate: total > 0 ? (paid.length / total) * 100 : 0,
            overdueRate: total > 0 ? (overdue.length / total) * 100 : 0
        };
    }

    // حساب أفضل العملاء
    getTopCustomers(installments, limit = 10) {
        const customerStats = {};

        installments.forEach(inst => {
            const customerId = inst.customer?.customerId;
            if (!customerId) return;

            if (!customerStats[customerId]) {
                customerStats[customerId] = {
                    customer: inst.customer,
                    totalPaid: 0,
                    paidCount: 0,
                    totalAmount: 0,
                    totalCount: 0
                };
            }

            customerStats[customerId].totalAmount += inst.amount || 0;
            customerStats[customerId].totalCount++;

            if (inst.status === 'Paid') {
                customerStats[customerId].totalPaid += inst.amount || 0;
                customerStats[customerId].paidCount++;
            }
        });

        return Object.values(customerStats)
            .map(stat => ({
                ...stat,
                paymentRate: stat.totalCount > 0 ? (stat.paidCount / stat.totalCount) * 100 : 0
            }))
            .sort((a, b) => b.totalPaid - a.totalPaid)
            .slice(0, limit);
    }

    // حساب أفضل الفروع
    getTopBranches(loans, installments, limit = 10) {
        const branchStats = {};

        loans.forEach(loan => {
            const branchId = loan.branchId;
            if (!branchId) return;

            if (!branchStats[branchId]) {
                branchStats[branchId] = {
                    branch: loan.branch,
                    totalLoans: 0,
                    totalLoansAmount: 0,
                    activeLoans: 0,
                    completedLoans: 0
                };
            }

            branchStats[branchId].totalLoans++;
            branchStats[branchId].totalLoansAmount += loan.amount || 0;
            if (loan.status === 'Active') branchStats[branchId].activeLoans++;
            if (loan.status === 'Completed') branchStats[branchId].completedLoans++;
        });

        installments.forEach(inst => {
            const branchId = inst.branch?.branchId;
            if (!branchId || !branchStats[branchId]) return;

            if (!branchStats[branchId].installments) {
                branchStats[branchId].installments = { paid: 0, paidAmount: 0 };
            }

            if (inst.status === 'Paid') {
                branchStats[branchId].installments.paid++;
                branchStats[branchId].installments.paidAmount += inst.amount || 0;
            }
        });

        return Object.values(branchStats)
            .sort((a, b) => (b.installments?.paidAmount || 0) - (a.installments?.paidAmount || 0))
            .slice(0, limit);
    }

    // مقارنة وحدتين (فرع مع فرع، مؤسسة مع مؤسسة، إلخ)
    compareUnits(unit1Data, unit2Data, type = 'branch') {
        const stats1 = {
            loans: this.calculateLoanStats(unit1Data.loans),
            installments: this.calculateInstallmentStats(unit1Data.installments)
        };

        const stats2 = {
            loans: this.calculateLoanStats(unit2Data.loans),
            installments: this.calculateInstallmentStats(unit2Data.installments)
        };

        return {
            unit1: stats1,
            unit2: stats2,
            comparison: {
                loansDiff: stats1.loans.total - stats2.loans.total,
                loansDiffPercent: stats2.loans.total > 0
                    ? ((stats1.loans.total - stats2.loans.total) / stats2.loans.total) * 100
                    : 0,
                amountDiff: stats1.loans.totalAmount - stats2.loans.totalAmount,
                amountDiffPercent: stats2.loans.totalAmount > 0
                    ? ((stats1.loans.totalAmount - stats2.loans.totalAmount) / stats2.loans.totalAmount) * 100
                    : 0,
                collectionRateDiff: stats1.installments.collectionRate - stats2.installments.collectionRate
            }
        };
    }

    // كشف المخاطر
    detectRisks(data) {
        const risks = [];

        // كشف الأقساط المتأخرة
        const overdueInstallments = data.installments.filter(i => i.status === 'Overdue');
        if (overdueInstallments.length > 0) {
            const overdueAmount = overdueInstallments.reduce((sum, i) => sum + (i.amount || 0), 0);
            risks.push({
                type: 'overdue',
                severity: overdueInstallments.length > 10 ? 'high' : overdueInstallments.length > 5 ? 'medium' : 'low',
                title: 'أقساط متأخرة',
                message: `يوجد ${overdueInstallments.length} قسط متأخر بقيمة إجمالية ${overdueAmount.toLocaleString('ar-SA')} ر.س`,
                count: overdueInstallments.length,
                amount: overdueAmount
            });
        }

        // كشف النشاط المنخفض
        const now = new Date();
        const thisMonth = data.loans.filter(loan => {
            const loanDate = new Date(loan.createdAt);
            return loanDate.getMonth() === now.getMonth() && loanDate.getFullYear() === now.getFullYear();
        });

        if (thisMonth.length === 0) {
            risks.push({
                type: 'low_activity',
                severity: 'medium',
                title: 'نشاط منخفض',
                message: 'لم يتم تسجيل أي قروض جديدة هذا الشهر',
                count: 0
            });
        }

        // كشف العملاء المتعثرين
        const customerDefaults = {};
        data.installments.forEach(inst => {
            if (inst.status === 'Overdue') {
                const customerId = inst.customer?.customerId;
                if (customerId) {
                    customerDefaults[customerId] = (customerDefaults[customerId] || 0) + 1;
                }
            }
        });

        const highRiskCustomers = Object.entries(customerDefaults).filter(([_, count]) => count >= 3);
        if (highRiskCustomers.length > 0) {
            risks.push({
                type: 'customer_risk',
                severity: 'high',
                title: 'عملاء عالي المخاطر',
                message: `يوجد ${highRiskCustomers.length} عميل لديهم 3 أقساط متأخرة أو أكثر`,
                count: highRiskCustomers.length
            });
        }

        return risks;
    }

    // تصدير إلى CSV
    exportToCSV(data, columns, filename = 'report.csv') {
        const headers = columns.map(col => col.label).join(',');
        const rows = data.map(row =>
            columns.map(col => {
                const value = col.getValue ? col.getValue(row) : row[col.key];
                return typeof value === 'string' && value.includes(',')
                    ? `"${value}"`
                    : value;
            }).join(',')
        );

        const csv = [headers, ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    // تصدير إلى Excel
    exportToExcel(data, columns, filename = 'report.xlsx', sheetName = 'Sheet1') {
        const worksheet = XLSX.utils.json_to_sheet(
            data.map(row => {
                const obj = {};
                columns.forEach(col => {
                    obj[col.label] = col.getValue ? col.getValue(row) : row[col.key];
                });
                return obj;
            })
        );

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, filename);
    }

    // تصدير إلى PDF (يستخدم jsPDF)
    async exportToPDF(title, content, filename = 'report.pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // إضافة العنوان
        doc.setFontSize(18);
        doc.text(title, 105, 20, { align: 'center' });

        // إضافة المحتوى (يمكن تخصيصه حسب الحاجة)
        doc.setFontSize(12);
        let yPosition = 40;

        if (Array.isArray(content)) {
            content.forEach((line, index) => {
                if (yPosition > 280) {
                    doc.addPage();
                    yPosition = 20;
                }
                doc.text(String(line), 20, yPosition);
                yPosition += 10;
            });
        } else {
            doc.text(String(content), 20, yPosition);
        }

        doc.save(filename);
    }
}

// إنشاء نسخة عامة
window.reportsEngine = new ReportsEngine();
