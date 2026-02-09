export class BranchDashboardMetricsDto {
  totalCustomers: number;
  totalLoans: number;
  activeLoans: number;
  lateLoans: number;
  totalPortfolioValue: number;
  averageLoanSize: number;
}

export class BranchInstitutionDto {
  id: number;
  name: string;
}

export class ActivityDto {
  id: number;
  type: "customer_added" | "loan_created" | "payment_received" | "note_added";
  description: string;
  user: string;
  timestamp: string;
}

export class BranchDashboardStatsDto {
  branchId: number;
  branchName: string;
  institution: BranchInstitutionDto;
  metrics: BranchDashboardMetricsDto;
  teamMembers: number;
  recentActivities: ActivityDto[];
}

export class BranchTeamMemberDto {
  id: number;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
}

export class BranchCustomerDto {
  customerId: number;
  name: string;
  nationalId: string;
  phoneNumber: string;
  totalLoans: number;
  activeLoans: number;
  createdAt: Date;
}

export class BranchLoanDto {
  loanId: number;
  customerName: string;
  customerId: number;
  principalAmount: number;
  status: string;
  createdAt: Date;
  dueDate: Date | null;
  productName: string;
}
