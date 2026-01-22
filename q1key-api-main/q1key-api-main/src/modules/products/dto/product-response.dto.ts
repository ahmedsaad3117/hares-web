export class ProductResponseDto {
  productId: number;
  institutionId?: number;
  branchId?: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  institutionName?: string;
  branchName?: string;
}
