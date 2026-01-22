export interface JwtPayload {
  sub: number; // userId
  email: string;
  roleId: number;
  roleName: string;
  institutionId?: number;
  branchId?: number;
  sessionId: string; // Unique session identifier
}
