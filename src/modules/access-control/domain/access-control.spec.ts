import { describe, expect, it } from 'vitest';

import { hasPermission, Permission, Role } from './access-control.js';

describe('role permissions', () => {
  it('allows administrators to manage users without reading clinical content', () => {
    expect(hasPermission(Role.Admin, Permission.UserCreate)).toBe(true);
    expect(hasPermission(Role.Admin, Permission.UserRead)).toBe(true);
    expect(hasPermission(Role.Admin, Permission.UserPasswordReset)).toBe(true);
    expect(hasPermission(Role.Admin, Permission.DocumentAnnul)).toBe(true);
    expect(hasPermission(Role.Admin, Permission.DocumentContentReadAll)).toBe(false);
    expect(hasPermission(Role.Admin, Permission.NotificationReadOwn)).toBe(true);
  });

  it('allows operators to manage documents without managing users', () => {
    expect(hasPermission(Role.Operator, Permission.DocumentCreate)).toBe(true);
    expect(hasPermission(Role.Operator, Permission.DocumentPublish)).toBe(true);
    expect(hasPermission(Role.Operator, Permission.UserCreate)).toBe(false);
    expect(hasPermission(Role.Operator, Permission.NotificationReadOwn)).toBe(true);
  });

  it('restricts patients to their own published document capabilities', () => {
    expect(hasPermission(Role.Patient, Permission.DocumentReadOwn)).toBe(true);
    expect(hasPermission(Role.Patient, Permission.DocumentDownloadOwn)).toBe(true);
    expect(hasPermission(Role.Patient, Permission.DocumentMetadataReadAll)).toBe(false);
    expect(hasPermission(Role.Patient, Permission.NotificationUpdateOwn)).toBe(true);
  });
});
