import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickLink } from './quick-link.entity';
import { QuickLinksService } from './quick-links.service';
import { QuickLinksController } from './quick-links.controller';
import { AuthModule } from '../modules/auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([QuickLink]),
        AuthModule,
    ],
    controllers: [QuickLinksController],
    providers: [QuickLinksService],
    exports: [QuickLinksService],
})
export class QuickLinksModule { }

