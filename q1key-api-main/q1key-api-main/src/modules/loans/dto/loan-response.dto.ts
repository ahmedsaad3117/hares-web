import { LoanStatus } from "../../../entities/loan.entity";
import { InstallmentStatus } from "../../../entities/installment-status.enum";

export class LoanResponseDto {
  loanId: number;
  customerId: number;
  branchId?: number;
  institutionId?: number;
  productId: number;
  principalAmount: number;
  profitAmount?: number;
  status: LoanStatus;
  createdBy?: number;
  createdByName?: string;
  createdAt: Date;
  dueDate: Date | null;
  updatedAt: Date;
  paymentPlanMonths?: number;
  paidAmount?: number;
  customer?: {
    customerId: number;
    name: string;
    nationalId: string;
    phoneNumber: string;
  };
  branch?: {
    branchId: number;
    name: string;
    phoneNumber?: string;
    institution?: {
      institutionId: number;
      name: string;
      phoneNumber?: string;
    };
  };
  institution?: {
    institutionId: number;
    name: string;
    phoneNumber?: string;
  };
  product?: {
    productId: number;
    name: string;
  };
  installments?: {
    id: number;
    installmentNumber: number;
    dueDate: Date;
    amount: number;
    status: InstallmentStatus;
    paymentDate: Date | null;
  }[];
}
