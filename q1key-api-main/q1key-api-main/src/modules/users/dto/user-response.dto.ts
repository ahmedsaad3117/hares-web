export class UserResponseDto {
  userId: number;
  roleId: number;
  institutionId?: number;
  branchId?: number;
  name: string;
  email: string;
  phoneNumber?: string;
  nationalId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roleName?: string;
  institutionName?: string;
  branchName?: string;
  expirationDate?: string | Date | null;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
