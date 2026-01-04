import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma/prisma.module';
import { ShiftsService } from './shifts.service';
import { ShiftsResolver } from './shifts.resolver';
import { DateUtilsService } from './services/date-utils.service';

@Module({
  imports: [PrismaModule],
  providers: [ShiftsService, ShiftsResolver, DateUtilsService],
  exports: [ShiftsService],
})
export class ShiftsModule {} 