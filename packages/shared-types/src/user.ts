import type { Role } from "./role";

export interface PublicUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  /** Sadece role=USER için anlamlıdır: bağlı olduğu Admin'in kimliği. */
  adminOwnerId: string | null;
  adminOwnerName: string | null;
  /** Sadece role=ADMIN için anlamlıdır: kök "Bütün Ürünler" sekmesinin özelleştirilmiş adı. */
  rootAllWarehousesLabel: string | null;
  /** Sadece role=USER için anlamlıdır: açıkça yetkilendirildiği depo id'leri. Boşsa tüm depo havuzuna erişir. */
  warehouseAccessIds: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}
