import type { Role } from "./role";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  /** Sadece role=USER için anlamlıdır: bağlı olduğu Admin'in kimliği. */
  adminOwnerId: string | null;
  adminOwnerName: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}
