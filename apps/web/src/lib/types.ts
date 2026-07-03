import type { Confidence, MovementType } from '@repo/shared-types';

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  categoryId: string | null;
  category: Category | null;
  warehouseId: string;
  warehouse: { id: string; name: string } | null;
  imageUrl: string | null;
  sortOrder: number;
  currentStock: number;
  leadTimeDays: number;
  safetyMarginDays: number;
  criticalLevel: number;
  criticalLevelManual: number | null;
  suggestedCriticalLevel: number | null;
  avgDailyConsumption7d: number;
  avgDailyConsumption30d: number;
  confidence: Confidence;
  createdAt: string;
  updatedAt: string;
  /** Sadece "Bütün Ürünler" görünümünde, aynı isme sahip ürünler ortak alanda birleştirildiğinde dolar. */
  mergedWarehouses?: { id: string; productId: string; name: string; stock: number }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: MovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
  product: { id: string; name: string; unit: string };
  user: { id: string; name: string };
}

export interface StockAlert {
  id: string;
  name: string;
  unit: string;
  category: string | null;
  currentStock: number;
  criticalLevel: number;
  avgDailyConsumption7d: number;
  daysUntilStockout: number | null;
  severity: 'OUT_OF_STOCK' | 'CRITICAL';
}

export interface StockSummary {
  totalProducts: number;
  criticalCount: number;
  outOfStockCount: number;
  movementsToday: number;
}

export interface TrendPoint {
  date: string;
  in: number;
  out: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  meta: string | null;
  createdAt: string;
  user: { id: string; name: string; username: string; role: string } | null;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  ownerId: string;
  ownerName: string | null;
  createdAt: string;
  productCount: number;
  criticalCount: number;
  userCount: number;
}
