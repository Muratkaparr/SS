import { CopyPlus, ImageOff, Pencil, Trash2 } from 'lucide-react';
import { PhotoUploadButton } from '@/components/admin/photo-upload-button';
import { Badge } from '@/components/ui/badge';
import { StockStepper } from '@/components/products/stock-stepper';
import { productImageUrl } from '@/lib/image-url';
import type { Product } from '@/lib/types';

function stockTone(product: Product): 'danger' | 'warning' | 'success' {
  if (product.currentStock <= 0) return 'danger';
  if (product.currentStock <= product.criticalLevel) return 'warning';
  return 'success';
}

function stockLabel(product: Product): string {
  if (product.currentStock <= 0) return 'Tükendi';
  if (product.currentStock <= product.criticalLevel) return 'Kritik';
  return 'Normal';
}

export function ProductCard({
  product,
  canAdjustStock,
  canManagePhoto,
  onEdit,
  onDelete,
  onDuplicate,
  showWarehouseBadge,
}: {
  product: Product;
  canAdjustStock?: boolean;
  canManagePhoto?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
  /** "Bütün Ürünler" görünümünde hangi depoya ait olduğunu gösterir. */
  showWarehouseBadge?: boolean;
}) {
  const imageSrc = productImageUrl(product.imageUrl);

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-surface">
      <div className="relative aspect-square w-full bg-surface-2">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- ürün görselleri harici API originden geliyor
          <img
            src={imageSrc}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted">
            <ImageOff size={22} />
            <span className="text-xs">Fotoğraf yok</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <Badge tone={stockTone(product)}>{stockLabel(product)}</Badge>
          {showWarehouseBadge && product.warehouse && (
            <span
              title={product.mergedWarehouses
                ?.map((w) => `${w.name}: ${w.stock} ${product.unit}`)
                .join('\n')}
            >
              <Badge tone="accent" withIcon={false}>
                {product.warehouse.name}
                {product.mergedWarehouses && product.mergedWarehouses.length > 1
                  ? ` +${product.mergedWarehouses.length - 1}`
                  : ''}
              </Badge>
            </span>
          )}
        </div>
        {canManagePhoto && <PhotoUploadButton productId={product.id} />}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="truncate text-sm font-medium text-ink" title={product.name}>
            {product.name}
          </p>
        </div>

        {canAdjustStock ? (
          <StockStepper
            productId={product.id}
            currentStock={product.currentStock}
            unit={product.unit}
            className="mt-1"
          />
        ) : (
          <p className="text-lg font-semibold text-ink">
            {product.currentStock} <span className="text-sm font-normal text-muted">{product.unit}</span>
          </p>
        )}

        {(onEdit || onDelete || onDuplicate) && (
          <div className="mt-1 flex items-center gap-1.5 border-t border-border pt-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-ink"
                title="Düzenle"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(product)}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out-quart hover:bg-surface-hover hover:text-accent"
                title="Başka depoya ekle"
              >
                <CopyPlus size={14} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(product)}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out-quart hover:bg-danger/10 hover:text-danger"
                title="Sil"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
