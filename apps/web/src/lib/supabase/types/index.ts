export interface CookieOptions {
  path?: string;
  maxAge?: number;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

export interface CookieContainer {
  get: (name: string) => { name: string; value: string } | undefined;
  set: (name: string, value: string, options: CookieOptions) => void;
}