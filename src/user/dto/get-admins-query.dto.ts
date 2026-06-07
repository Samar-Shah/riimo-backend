import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { USER_STATUS } from '../../constants';

export const USER_ROLE_QUERY_STATUSES = [
  USER_STATUS.INVITED,
  USER_STATUS.ACTIVE,
  'deleted',
  'banned',
] as const;

export type UserRoleQueryStatus = (typeof USER_ROLE_QUERY_STATUSES)[number];

/** Plain array for class-validator @IsIn (readonly tuples can lose values in metadata) */
export const USER_ROLE_QUERY_STATUS_VALUES: UserRoleQueryStatus[] = [
  ...USER_ROLE_QUERY_STATUSES,
];

// DTO class for admins query
export class GetUsersByRoleQueryDto {
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
  @IsIn(USER_ROLE_QUERY_STATUS_VALUES)
  status?: UserRoleQueryStatus;
}
