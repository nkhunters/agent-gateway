import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for triggering tool synchronization
 *
 * If serverId is provided, syncs only that server
 * If omitted, syncs all active servers
 */
export class SyncToolsDto {
  @IsOptional()
  @IsString()
  serverId?: string; // If provided, sync only this server
}
