/**
 * facades/errors.ts
 *
 * Các lỗi có kiểu cho L3 Role Façades.
 */

export type PermissionErrorCode =
  | 'PERMISSION_DENIED'   // phương thức vượt quá quyền của vai trò
  | 'NOT_AUTHENTICATED'   // salesId không hợp lệ
  | 'DISTRICT_NOT_FOUND'; // salesId không có cụm được gán

export interface PermissionErrorDetails {
  code: PermissionErrorCode;
  role: string;
  method: string;
  message?: string;
}

/**
 * Ném lỗi khi một vai trò cố gọi phương thức vượt quá quyền.
 */
export class PermissionError extends Error {
  readonly details: PermissionErrorDetails;

  constructor(details: PermissionErrorDetails) {
    super(details.message ?? `Role "${details.role}" cannot call "${details.method}"`);
    this.name = 'PermissionError';
    this.details = details;
  }
}
