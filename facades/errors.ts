/**
 * facades/errors.ts
 *
 * Typed errors cho L3 Role Façades.
 */

export type PermissionErrorCode =
  | 'PERMISSION_DENIED'   // method vượt quá permission của role
  | 'NOT_AUTHENTICATED'   // salesId không hợp lệ
  | 'DISTRICT_NOT_FOUND'; // salesId không có district được gán

export interface PermissionErrorDetails {
  code: PermissionErrorCode;
  role: string;
  method: string;
  message?: string;
}

/**
 * Throw khi một role cố gọi method ngoài permission.
 */
export class PermissionError extends Error {
  readonly details: PermissionErrorDetails;

  constructor(details: PermissionErrorDetails) {
    super(details.message ?? `Role "${details.role}" cannot call "${details.method}"`);
    this.name = 'PermissionError';
    this.details = details;
  }
}
