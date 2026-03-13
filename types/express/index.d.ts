import type { User } from '@supabase/supabase-js';

declare global {
  namespace Express {
    interface Request {
      admin?: { email: string } | User;
    }
  }
}

export {};
