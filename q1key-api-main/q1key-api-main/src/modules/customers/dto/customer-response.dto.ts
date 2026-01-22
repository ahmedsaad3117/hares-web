import { TrustStatus } from '../../../entities/trust-status.enum';

export class CustomerResponseDto {
  customerId: number;
  name: string;
  nationalId: string;
  phoneNumber: string;
  trustStatus: TrustStatus;
  institutionId?: number;
  institutionName?: string;
  createdBy?: number;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  deletedBy?: number;
  deletedByName?: string;
  branchName?: string;
  isLinked?: boolean;
}
