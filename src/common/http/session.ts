import type { Session } from 'express-session';

export function regenerateSession(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    session.regenerate((error: unknown) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(toError(error, 'Could not regenerate the session.'));
      }
    });
  });
}

export function saveSession(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    session.save((error: unknown) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(toError(error, 'Could not save the session.'));
      }
    });
  });
}

export function destroySession(session: Session): Promise<void> {
  return new Promise((resolve, reject) => {
    session.destroy((error: unknown) => {
      if (error === undefined || error === null) {
        resolve();
      } else {
        reject(toError(error, 'Could not destroy the session.'));
      }
    });
  });
}

function toError(value: unknown, fallbackMessage: string): Error {
  return value instanceof Error ? value : new Error(fallbackMessage);
}
