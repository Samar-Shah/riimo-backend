import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetOrganizationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;

  @IsOptional()
  @IsString()
  sortBy: 'createdAt' | 'updatedAt' | 'name' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  @IsIn(['active', 'banned', 'deleted'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
