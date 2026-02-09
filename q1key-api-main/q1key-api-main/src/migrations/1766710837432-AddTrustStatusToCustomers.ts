import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTrustStatusToCustomers1766710837432 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add trust_status enum column to customers table
    await queryRunner.addColumn(
      "customers",
      new TableColumn({
        name: "trust_status",
        type: "enum",
        enum: ["Unverified", "Trusted", "Suspicious", "Flagged", "Blocked"],
        default: "'Unverified'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove trust_status column from customers table
    await queryRunner.dropColumn("customers", "trust_status");
  }
}
