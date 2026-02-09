import { IsEnum } from "class-validator";
import { TrustStatus } from "../../../entities/trust-status.enum";

export class UpdateTrustStatusDto {
  @IsEnum(TrustStatus, {
    message:
      "trust_status must be one of: Unverified, Trusted, Suspicious, Flagged, Blocked",
  })
  trust_status: TrustStatus;
}
