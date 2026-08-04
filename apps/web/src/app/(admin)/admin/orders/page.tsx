import { OrdersList } from '@/components/orders/orders-list';

export default function AdminOrdersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Siparişler</h1>
        <p className="mt-1 text-sm text-muted">Kullanıcılardan gelen ürün taleplerini karşılayın veya reddedin.</p>
      </div>

      <OrdersList canDecide />
    </div>
  );
}
