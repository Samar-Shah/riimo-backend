import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { USER_STATUS } from '../../constants';

export const ADMIN_QUERY_STATUSES = [
  USER_STATUS.INVITED,
  USER_STATUS.ACTIVE,
  'deleted',
  'banned',
] as const;

export type AdminQueryStatus = (typeof ADMIN_QUERY_STATUSES)[number];

/** Plain array for class-validator @IsIn (readonly tuples can lose values in metadata) */
export const ADMIN_QUERY_STATUS_VALUES: AdminQueryStatus[] = [
  ...ADMIN_QUERY_STATUSES,
];

// DTO class for admins query
export class GetAdminsQueryDto {
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
  sortBy: 'createdAt' | 'updatedAt' | 'name' | 'email' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(ADMIN_QUERY_STATUS_VALUES)
  status?: AdminQueryStatus;
}
