import type { AuthenticatedPrincipal } from './authenticated-principal.js';

declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedPrincipal;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedPrincipal;
    }
  }
}

export {};
