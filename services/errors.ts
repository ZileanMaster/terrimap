/**
 * services/errors.ts
 *
 * Typed error classes cho L2 Domain Services.
 * Không throw raw string hay generic Error.
 */

// ─── ServiceErrorCode ─────────────────────────────────────────────────────────

export type ServiceErrorCode =
  | 'INVALID_INPUT'      // Input không hợp lệ (zones rỗng, giá trị âm, ...)
  | 'PARTITION_FAILED'   // L1b PartitionError được wrap
  | 'VALIDATION_FAILED'  // L1c validatePartition throw
  | 'ZONE_NOT_FOUND'     // zoneId không tồn tại trong array
  | 'SAME_DISTRICT'      // manualSwap: from === to
  | 'SWAP_DISCONNECTS';  // manualSwap tạo disconnected district

// ─── VersionErrorCode ─────────────────────────────────────────────────────────

export type VersionErrorCode =
  | 'DUPLICATE_LABEL'    // Label snapshot đã tồn tại
  | 'SNAPSHOT_NOT_FOUND';// Snapshot không tìm thấy

// ─── ServiceError ─────────────────────────────────────────────────────────────

export interface ServiceErrorDetails {
  code: ServiceErrorCode;
  message?: string;
  originalError?: unknown;
  districtId?: number;
}

/**
 * Lỗi có định danh từ L2 TerritoryService, ActivityService, MapService.
 * Luôn có `details.code` để caller match cụ thể.
 */
export class ServiceError extends Error {
  readonly details: ServiceErrorDetails;

  constructor(details: ServiceErrorDetails) {
    super(details.message ?? details.code);
    this.name = 'ServiceError';
    this.details = details;
  }
}

// ─── VersionError ──────────────────────────────────────────────────────────────

export interface VersionErrorDetails {
  code: VersionErrorCode;
  message?: string;
}

/**
 * Lỗi có định danh từ L2 VersionService.
 */
export class VersionError extends Error {
  readonly details: VersionErrorDetails;

  constructor(details: VersionErrorDetails) {
    super(details.message ?? details.code);
    this.name = 'VersionError';
    this.details = details;
  }
}
