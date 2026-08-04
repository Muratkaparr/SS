import { OrderForm } from '@/components/orders/order-form';
import { OrdersList } from '@/components/orders/orders-list';

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Siparişler</h1>
        <p className="mt-1 text-sm text-muted">
          Yeni sipariş oluşturun; kullanıcılardan gelen talepleri karşılayın veya reddedin.
        </p>
      </div>

      <OrderForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Tüm Siparişler</h2>
        <OrdersList canDecide />
      </div>
    </div>
  );
}
