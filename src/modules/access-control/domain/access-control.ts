export enum Role {
  Admin = 'ADMIN',
  Operator = 'OPERATOR',
  Patient = 'PATIENT',
}

export enum Permission {
  UserCreate = 'user:create',
  UserRead = 'user:read',
  UserUpdate = 'user:update',
  UserDisable = 'user:disable',
  UserReactivate = 'user:reactivate',
  UserPasswordReset = 'user:password-reset',
  RoleAssign = 'role:assign',
  AuditRead = 'audit:read',
  AuditExport = 'audit:export',
  DocumentMetadataReadAll = 'document:metadata:read-all',
  DocumentContentReadAll = 'document:content:read-all',
  DocumentCreate = 'document:create',
  DocumentUpdateDraft = 'document:update-draft',
  DocumentPublish = 'document:publish',
  DocumentDeleteRecoverable = 'document:delete-recoverable',
  DocumentAnnul = 'document:annul',
  DocumentReadOwn = 'document:read-own',
  DocumentDownloadOwn = 'document:download-own',
  DocumentHistoryReadOwn = 'document:history:read-own',
  NotificationReadOwn = 'notification:read-own',
  NotificationUpdateOwn = 'notification:update-own',
  ProcessingJobRead = 'processing-job:read',
  ProcessingJobRetry = 'processing-job:retry',
  SystemHealthRead = 'system:health:read',
}

const rolePermissions: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  [Role.Admin]: new Set([
    Permission.UserCreate,
    Permission.UserRead,
    Permission.UserUpdate,
    Permission.UserDisable,
    Permission.UserReactivate,
    Permission.UserPasswordReset,
    Permission.RoleAssign,
    Permission.AuditRead,
    Permission.AuditExport,
    Permission.DocumentMetadataReadAll,
    Permission.DocumentAnnul,
    Permission.ProcessingJobRead,
    Permission.SystemHealthRead,
    Permission.NotificationReadOwn,
    Permission.NotificationUpdateOwn,
  ]),
  [Role.Operator]: new Set([
    Permission.DocumentMetadataReadAll,
    Permission.DocumentContentReadAll,
    Permission.DocumentCreate,
    Permission.DocumentUpdateDraft,
    Permission.DocumentPublish,
    Permission.DocumentDeleteRecoverable,
    Permission.ProcessingJobRead,
    Permission.ProcessingJobRetry,
    Permission.NotificationReadOwn,
    Permission.NotificationUpdateOwn,
  ]),
  [Role.Patient]: new Set([
    Permission.DocumentReadOwn,
    Permission.DocumentDownloadOwn,
    Permission.DocumentHistoryReadOwn,
    Permission.NotificationReadOwn,
    Permission.NotificationUpdateOwn,
  ]),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function getPermissions(role: Role): readonly Permission[] {
  return [...rolePermissions[role]];
}
