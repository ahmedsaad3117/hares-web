import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstitutionsService } from './institutions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Institution } from '../../entities/institution.entity';

@Injectable()
export class InstitutionsScheduler {
  private readonly logger = new Logger(InstitutionsScheduler.name);

  constructor(
    @InjectRepository(Institution)
    private institutionsRepository: Repository<Institution>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkExpiredInstitutions() {
    this.logger.log('Running daily check for expired institutions...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find all active institutions where expiration date has passed
      const expiredInstitutions = await this.institutionsRepository.find({
        where: {
          isActive: true,
          expirationDate: LessThan(today),
        },
      });

      if (expiredInstitutions.length === 0) {
        this.logger.log('No expired institutions found.');
        return;
      }

      this.logger.log(`Found ${expiredInstitutions.length} expired institution(s). Deactivating...`);

      // Deactivate expired institutions
      for (const institution of expiredInstitutions) {
        institution.isActive = false;
        await this.institutionsRepository.save(institution);
        this.logger.log(`Deactivated institution: ${institution.name} (ID: ${institution.institutionId})`);
      }

      this.logger.log('Expired institutions check completed successfully.');
    } catch (error) {
      this.logger.error('Error checking expired institutions:', error);
    }
  }
}
