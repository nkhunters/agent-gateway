import { IsString, IsUrl, IsOptional, Length, Matches } from 'class-validator';

/**
 * DTO for registering a new MCP server
 *
 * Validates server configuration before registration
 */
export class RegisterMCPServerDto {
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'serverId must contain only lowercase letters, numbers, and hyphens'
  })
  serverId!: string;

  @IsString()
  @Length(3, 100)
  name!: string;

  @IsString()
  @Length(10, 500)
  description!: string;

  @IsUrl({ require_tld: false }, { message: 'endpoint must be a valid HTTP/HTTPS URL' })
  endpoint!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  healthCheckUrl?: string;
}
