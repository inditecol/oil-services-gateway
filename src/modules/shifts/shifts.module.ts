import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma/prisma.module';
import { ShiftsService } from './shifts.service';
import { ShiftsResolver } from './shifts.resolver';
import { DateUtilsService } from './services/date-utils.service';
import { AuditoriaTurnoService } from './services/auditoria-turno.service';
import { AuditoriaTurnoResolver } from './auditoria-turno.resolver';

@Module({
  imports: [PrismaModule],
  providers: [ShiftsService, ShiftsResolver, DateUtilsService, AuditoriaTurnoService, AuditoriaTurnoResolver],
  exports: [ShiftsService, AuditoriaTurnoService],
})
export class ShiftsModule {} 