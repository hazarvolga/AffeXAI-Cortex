import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCrmCustomerDto } from './create-crm-customer.dto';

export class ImportCrmCustomersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCrmCustomerDto)
  customers: CreateCrmCustomerDto[];
}
