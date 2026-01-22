import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashBoxService } from './cash-box.service';
import { CashBoxController } from './cash-box.controller';
import { CashBox } from '../../entities/cash-box.entity';
import { CashBoxTransaction } from '../../entities/cash-box-transaction.entity';
import { Branch } from '../../entities/branch.entity';
import { Institution } from '../../entities/institution.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([CashBox, CashBoxTransaction, Branch, Institution]),
    ],
    controllers: [CashBoxController],
    providers: [CashBoxService],
    exports: [CashBoxService],
})
export class CashBoxModule { }
