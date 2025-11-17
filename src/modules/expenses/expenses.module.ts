import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesResolver } from './expenses.resolver';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ExpensesService, ExpensesResolver],
  exports: [ExpensesService],
})
export class ExpensesModule {}

