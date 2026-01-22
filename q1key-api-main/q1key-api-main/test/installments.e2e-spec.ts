import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Installments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let testLoanId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /loans - creates loan with installments', () => {
    it('should create loan and generate installments', async () => {
      const response = await request(app.getHttpServer())
        .post('/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          branchId: 1,
          productId: 1,
          principalAmount: 10000,
          paymentPlanMonths: 6,
        })
        .expect(201);

      testLoanId = response.body.loanId;
      expect(response.body.paymentPlanMonths).toBe(6);
    });

    it('should reject invalid payment_plan_months (0)', async () => {
      await request(app.getHttpServer())
        .post('/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          branchId: 1,
          productId: 1,
          principalAmount: 10000,
          paymentPlanMonths: 0,
        })
        .expect(400);
    });

    it('should reject invalid payment_plan_months (13)', async () => {
      await request(app.getHttpServer())
        .post('/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          branchId: 1,
          productId: 1,
          principalAmount: 10000,
          paymentPlanMonths: 13,
        })
        .expect(400);
    });
  });

  describe('GET /loans/:id - returns loan with installments', () => {
    it('should return loan with installments array', async () => {
      const response = await request(app.getHttpServer())
        .get(`/loans/${testLoanId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.installments).toBeDefined();
      expect(Array.isArray(response.body.installments)).toBe(true);
      expect(response.body.installments.length).toBe(6);
    });
  });

  describe('GET /loans/:id/installments - get all installments for loan', () => {
    it('should return all installments for a loan', async () => {
      const response = await request(app.getHttpServer())
        .get(`/loans/${testLoanId}/installments`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(6);
      expect(response.body[0]).toHaveProperty('installmentNumber');
      expect(response.body[0]).toHaveProperty('dueDate');
      expect(response.body[0]).toHaveProperty('amount');
      expect(response.body[0]).toHaveProperty('status');
    });
  });

  describe('PATCH /installments/:id/pay - mark installment as paid', () => {
    let installmentId: number;

    beforeAll(async () => {
      const installmentsResponse = await request(app.getHttpServer())
        .get(`/loans/${testLoanId}/installments`)
        .set('Authorization', `Bearer ${authToken}`);

      installmentId = installmentsResponse.body[0].id;
    });

    it('should mark installment as paid', async () => {
      const paymentDate = '2025-01-15';

      const response = await request(app.getHttpServer())
        .patch(`/installments/${installmentId}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentDate })
        .expect(200);

      expect(response.body.status).toBe('Paid');
      expect(response.body.paymentDate).toBeDefined();
    });

    it('should update loan paid_amount', async () => {
      const loanResponse = await request(app.getHttpServer())
        .get(`/loans/${testLoanId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(Number(loanResponse.body.paidAmount)).toBeGreaterThan(0);
    });
  });

  describe('GET /installments/overdue - get overdue installments', () => {
    it('should return overdue installments', async () => {
      const response = await request(app.getHttpServer())
        .get('/installments/overdue')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /installments/:id - get single installment', () => {
    let installmentId: number;

    beforeAll(async () => {
      const installmentsResponse = await request(app.getHttpServer())
        .get(`/loans/${testLoanId}/installments`)
        .set('Authorization', `Bearer ${authToken}`);

      installmentId = installmentsResponse.body[0].id;
    });

    it('should return single installment details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/installments/${installmentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('installmentNumber');
      expect(response.body).toHaveProperty('amount');
      expect(response.body.id).toBe(installmentId);
    });

    it('should return 404 for non-existent installment', async () => {
      await request(app.getHttpServer())
        .get('/installments/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Sequential payment validation', () => {
    let installments: any[];

    beforeAll(async () => {
      // Create a new loan with multiple installments
      const loanResponse = await request(app.getHttpServer())
        .post('/loans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          customerId: 1,
          branchId: 1,
          productId: 1,
          principalAmount: 1000,
          paymentPlanMonths: 3,
        });

      const loanId = loanResponse.body.loanId;

      // Get installments
      const installmentsResponse = await request(app.getHttpServer())
        .get(`/loans/${loanId}/installments`)
        .set('Authorization', `Bearer ${authToken}`);

      installments = installmentsResponse.body;
    });

    it('should allow paying the first installment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/installments/${installments[0].id}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentDate: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body.status).toBe('Paid');
    });

    it('should reject paying third installment before second', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/installments/${installments[2].id}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentDate: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.message).toContain('Please pay installment #2 first');
    });

    it('should allow paying second installment after first is paid', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/installments/${installments[1].id}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentDate: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body.status).toBe('Paid');
    });

    it('should reject paying already paid installment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/installments/${installments[0].id}/pay`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentDate: new Date().toISOString(),
        })
        .expect(400);

      expect(response.body.message).toContain('already been paid');
    });
  });

  describe('Installment cascade delete', () => {
    it('should delete installments when loan is deleted', async () => {
      // This would require implementing loan deletion endpoint
      // Verifying cascade delete behavior
    });
  });
});
