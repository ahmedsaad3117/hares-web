import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomepageController } from './homepage.controller';
import { HomepageService } from './homepage.service';
import { HomePageSettings } from '../../entities/homepage-settings.entity';

@Module({
    imports: [TypeOrmModule.forFeature([HomePageSettings])],
    controllers: [HomepageController],
    providers: [HomepageService],
    exports: [HomepageService],
})
export class HomepageModule { }
