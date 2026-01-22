import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Customer } from '../../entities/customer.entity';
import { TrustStatus } from '../../entities/trust-status.enum';
import { UpdateTrustStatusDto } from './dto/update-trust-status.dto';
import { SearchLogsService } from '../search-logs/search-logs.service';

describe('CustomersService - Trust Status', () => {
  let service: CustomersService;
  let repository: Repository<Customer>;

  const mockRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockSearchLogsService = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: getRepositoryToken(Customer),
          useValue: mockRepository,
        },
        {
          provide: SearchLogsService,
          useValue: mockSearchLogsService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    repository = module.get<Repository<Customer>>(
      getRepositoryToken(Customer),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateTrustStatus', () => {
    const customerId = 1;
    const userId = 5;

    const mockCustomer: Partial<Customer> = {
      customerId: 1,
      name: 'John Doe',
      nationalId: '1234567890123',
      phoneNumber: '0123456789',
      trustStatus: TrustStatus.UNVERIFIED,
      institutionId: 1,
      createdBy: 1,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      loans: [],
    };

    it('should update trust status from Unverified to Trusted', async () => {
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.TRUSTED };
      const updatedCustomer = { ...mockCustomer, trustStatus: TrustStatus.TRUSTED };

      mockRepository.findOne.mockResolvedValue(mockCustomer);
      mockRepository.save.mockResolvedValue(updatedCustomer);

      const result = await service.updateTrustStatus(customerId, dto, userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { customerId },
      });
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockCustomer,
        trustStatus: TrustStatus.TRUSTED,
      });
      expect(result.trustStatus).toBe(TrustStatus.TRUSTED);
    });

    it('should update trust status to Suspicious', async () => {
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.SUSPICIOUS };
      const updatedCustomer = { ...mockCustomer, trustStatus: TrustStatus.SUSPICIOUS };

      mockRepository.findOne.mockResolvedValue(mockCustomer);
      mockRepository.save.mockResolvedValue(updatedCustomer);

      const result = await service.updateTrustStatus(customerId, dto, userId);

      expect(result.trustStatus).toBe(TrustStatus.SUSPICIOUS);
    });

    it('should update trust status to Flagged', async () => {
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.FLAGGED };
      const updatedCustomer = { ...mockCustomer, trustStatus: TrustStatus.FLAGGED };

      mockRepository.findOne.mockResolvedValue(mockCustomer);
      mockRepository.save.mockResolvedValue(updatedCustomer);

      const result = await service.updateTrustStatus(customerId, dto, userId);

      expect(result.trustStatus).toBe(TrustStatus.FLAGGED);
    });

    it('should update trust status to Blocked', async () => {
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.BLOCKED };
      const updatedCustomer = { ...mockCustomer, trustStatus: TrustStatus.BLOCKED };

      mockRepository.findOne.mockResolvedValue(mockCustomer);
      mockRepository.save.mockResolvedValue(updatedCustomer);

      const result = await service.updateTrustStatus(customerId, dto, userId);

      expect(result.trustStatus).toBe(TrustStatus.BLOCKED);
    });

    it('should update trust status back to Unverified', async () => {
      const customerWithStatus = { ...mockCustomer, trustStatus: TrustStatus.SUSPICIOUS };
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.UNVERIFIED };
      const updatedCustomer = { ...customerWithStatus, trustStatus: TrustStatus.UNVERIFIED };

      mockRepository.findOne.mockResolvedValue(customerWithStatus);
      mockRepository.save.mockResolvedValue(updatedCustomer);

      const result = await service.updateTrustStatus(customerId, dto, userId);

      expect(result.trustStatus).toBe(TrustStatus.UNVERIFIED);
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.TRUSTED };

      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateTrustStatus(customerId, dto, userId),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { customerId },
      });
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should log the trust status change for audit trail', async () => {
      const freshCustomer = { ...mockCustomer, trustStatus: TrustStatus.UNVERIFIED };
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.FLAGGED };
      const updatedCustomer = { ...freshCustomer, trustStatus: TrustStatus.FLAGGED };

      mockRepository.findOne.mockResolvedValue(freshCustomer);
      mockRepository.save.mockResolvedValue(updatedCustomer);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.updateTrustStatus(customerId, dto, userId);

      expect(loggerSpy).toHaveBeenCalledWith(
        `Trust status updated for customer ${customerId}: ${TrustStatus.UNVERIFIED} → ${TrustStatus.FLAGGED} by user ${userId}`,
      );
    });

    it('should include trustStatus in the returned CustomerResponseDto', async () => {
      const dto: UpdateTrustStatusDto = { trust_status: TrustStatus.TRUSTED };
      const updatedCustomer = { ...mockCustomer, trustStatus: TrustStatus.TRUSTED };

      mockRepository.findOne.mockResolvedValue(mockCustomer);
      mockRepository.save.mockResolvedValue(updatedCustomer);

      const result = await service.updateTrustStatus(customerId, dto, userId);

      expect(result).toHaveProperty('trustStatus');
      expect(result.trustStatus).toBe(TrustStatus.TRUSTED);
      expect(result).toHaveProperty('customerId');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('nationalId');
      expect(result).toHaveProperty('phoneNumber');
    });

    it('should handle multiple status changes in sequence', async () => {
      // First change: Unverified → Suspicious
      const dto1: UpdateTrustStatusDto = { trust_status: TrustStatus.SUSPICIOUS };
      const customer1 = { ...mockCustomer, trustStatus: TrustStatus.SUSPICIOUS };

      mockRepository.findOne.mockResolvedValueOnce(mockCustomer);
      mockRepository.save.mockResolvedValueOnce(customer1);

      const result1 = await service.updateTrustStatus(customerId, dto1, userId);
      expect(result1.trustStatus).toBe(TrustStatus.SUSPICIOUS);

      // Second change: Suspicious → Flagged
      const dto2: UpdateTrustStatusDto = { trust_status: TrustStatus.FLAGGED };
      const customer2 = { ...customer1, trustStatus: TrustStatus.FLAGGED };

      mockRepository.findOne.mockResolvedValueOnce(customer1);
      mockRepository.save.mockResolvedValueOnce(customer2);

      const result2 = await service.updateTrustStatus(customerId, dto2, userId);
      expect(result2.trustStatus).toBe(TrustStatus.FLAGGED);

      // Third change: Flagged → Blocked
      const dto3: UpdateTrustStatusDto = { trust_status: TrustStatus.BLOCKED };
      const customer3 = { ...customer2, trustStatus: TrustStatus.BLOCKED };

      mockRepository.findOne.mockResolvedValueOnce(customer2);
      mockRepository.save.mockResolvedValueOnce(customer3);

      const result3 = await service.updateTrustStatus(customerId, dto3, userId);
      expect(result3.trustStatus).toBe(TrustStatus.BLOCKED);

      expect(mockRepository.save).toHaveBeenCalledTimes(3);
    });
  });
});
