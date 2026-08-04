import { OrderForm } from '@/components/orders/order-form';
import { OrdersList } from '@/components/orders/orders-list';

export default function UserOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Siparişler</h1>
        <p className="mt-1 text-sm text-muted">Ürün talebi oluşturun ve durumunu takip edin.</p>
      </div>

      <OrderForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Siparişlerim</h2>
        <OrdersList canCancel />
      </div>
    </div>
  );
}
