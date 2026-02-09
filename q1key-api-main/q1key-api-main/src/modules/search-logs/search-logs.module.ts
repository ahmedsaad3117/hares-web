import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SearchLog } from "../../entities/search-log.entity";
import { User } from "../../entities/user.entity";
import { SearchLogsService } from "./search-logs.service";
import { SearchLogsController } from "./search-logs.controller";

@Module({
  imports: [TypeOrmModule.forFeature([SearchLog, User])],
  controllers: [SearchLogsController],
  providers: [SearchLogsService],
  exports: [SearchLogsService],
})
export class SearchLogsModule {}
