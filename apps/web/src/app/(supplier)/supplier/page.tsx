import { OrdersList } from '@/components/orders/orders-list';

export default function SupplierOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Siparişler</h1>
        <p className="mt-1 text-sm text-muted">
          Onaylanan siparişleri tedarik edin; tedarik ettikçe stoktan düşülür ve sipariş kapanır.
        </p>
      </div>

      <OrdersList canSupply />
    </div>
  );
}
