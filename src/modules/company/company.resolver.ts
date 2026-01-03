import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

import { CompanyService } from './company.service';
import { Company } from './entities/company.entity';
import { ConfiguracionEmpresa } from './entities/configuracion-empresa.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateConfiguracionEmpresaDto } from './dto/create-configuracion-empresa.dto';
import { UpdateConfiguracionEmpresaDto } from './dto/update-configuracion-empresa.dto';
import { runInThisContext } from 'vm';

@Resolver(() => Company)
@UseGuards(JwtAuthGuard)
export class CompanyResolver {
  constructor(private readonly companyService: CompanyService) {}

  @Mutation(() => Company)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createCompany(@Args('createCompanyInput') createCompanyDto: CreateCompanyDto): Promise<Company> {
    return this.companyService.create(createCompanyDto);
  }

  @Query(() => [Company], { name: 'companies' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async findAll(): Promise<Company[]> {
    return this.companyService.findAll();
  }

  @Query(() => Company, { name: 'company' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Company> {
    const company = await this.companyService.findById(id);
    if (!company) {
      throw new Error('Empresa no encontrada');
    }
    return company;
  }

  @Query(() => Company, { name: 'companyByRut' })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async findByRut(@Args('rut') rut: string): Promise<Company> {
    const company = await this.companyService.findByRut(rut);
    if (!company) {
      throw new Error('Empresa no encontrada');
    }
    return company;
  }

  @Mutation(() => Company)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateCompany(@Args('updateCompanyInput') updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    return this.companyService.update(updateCompanyDto);
  }

  @Mutation(() => Company)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async removeCompany(@Args('id', { type: () => ID }) id: string): Promise<Company> {
    return this.companyService.remove(id);
  }

  @Mutation(() => Company)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async toggleCompanyStatus(@Args('id', { type: () => ID }) id: string): Promise<Company> {
    return this.companyService.toggleStatus(id);
  }

  // ==========================================
  // MUTACIONES Y QUERIES PARA CONFIGURACIÓN DE EMPRESA
  // ==========================================

  @Mutation(() => ConfiguracionEmpresa)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createConfiguracionEmpresa(
    @Args('createConfiguracionEmpresaInput') createConfiguracionDto: CreateConfiguracionEmpresaDto,
  ): Promise<ConfiguracionEmpresa> {
    return this.companyService.createConfiguracionEmpresa(createConfiguracionDto);
  }

  @Query(() => ConfiguracionEmpresa, { name: 'configuracionEmpresa', nullable: true })
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async getConfiguracionEmpresa(@Args('empresaId', { type: () => ID }) empresaId: string): Promise<ConfiguracionEmpresa | null> {
    return this.companyService.getConfiguracionEmpresa(empresaId);
  }

  @Mutation(() => ConfiguracionEmpresa)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async updateConfiguracionEmpresa(
    @Args('updateConfiguracionEmpresaInput') updateConfiguracionDto: UpdateConfiguracionEmpresaDto,
  ): Promise<ConfiguracionEmpresa> {
    return this.companyService.updateConfiguracionEmpresa(updateConfiguracionDto);
  }

  @Mutation(() => ConfiguracionEmpresa)
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager')
  async createOrUpdateConfiguracionEmpresa(
    @Args('createConfiguracionEmpresaInput') createConfiguracionDto: CreateConfiguracionEmpresaDto,
  ): Promise<ConfiguracionEmpresa> {
    return this.companyService.createOrUpdateConfiguracionEmpresa(createConfiguracionDto);
  }
} 