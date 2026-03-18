import { IsString, IsInt, IsOptional, IsArray, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAddOnOptionDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateAddOnGroupDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  maxSelectable!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddOnOptionDto)
  options?: CreateAddOnOptionDto[];
}

export class CreateMenuItemDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddOnGroupDto)
  addOnGroups?: CreateAddOnGroupDto[];
}
