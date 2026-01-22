export class SearchLogResponseDto {
  searchLogId: number;
  customerId: number;
  customerName: string;
  userId: number;
  userName: string;
  userEmail: string;
  searchQuery: string;
  searchType: string;
  ipAddress: string;
  createdAt: Date;

  // Institution/Branch info for contact
  institutionId?: number;
  institutionName?: string;
  institutionPhone?: string;
  branchId?: number;
  branchName?: string;
  branchPhone?: string;
}
