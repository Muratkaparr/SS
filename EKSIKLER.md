# Eksikler ve Bulgular

> Kod tabanının tamamı (3 panel + API backend) taranarak PRODUCT.md ve DESIGN.md'deki hedeflere göre çıkarılmış eksik/hatalı noktalar. Her panel ayrı bölümde, önem sırasına göre listelenmiştir. Dosya yolları ve satır numaraları verildiği yerde kod anında bulunabilir.

---

## 🔴 En kritik / çapraz bulgu: "Salt-okunur Kullanıcı" vaadi gerçek değil

PRODUCT.md açıkça şunu söylüyor: *"Kullanıcı (User): ... Hiçbir düzenleme yapamaz."* Ama hem frontend hem backend bunun tersini yapıyor — bu tek başına iki ayrı ajan tarafından bağımsız olarak doğrulandı:

- **Backend:** `apps/api/src/stock/stock.controller.ts:67-68` → `POST /stock/movements` endpoint'i `@Roles(Role.ADMIN, Role.USER)` ile açık: User rolü IN/OUT stok hareketi kaydedebiliyor (sadece ADJUSTMENT tipi engelleniyor, `stock.service.ts:48-52`).
- **Frontend:** `apps/web/src/app/(user)/panel/products/page.tsx:14-17,23` kullanıcıya *"Kartlardaki +/− ile stok miktarını güncelleyebilirsiniz"* diyor ve `ProductCard` → `StockStepper` (`components/products/stock-stepper.tsx`) gerçek bir mutasyon UI'ı render ediyor.
- Bu, aynı dosyanın (`panel/page.tsx:20`) bir tık ötesinde *"düzenleme yetkiniz bulunmuyor"* demesiyle doğrudan çelişiyor — ürünün kendi iç tutarlılığı bile bozuk.

**Etkisi:** Herhangi bir "Kullanıcı" rolündeki depo çalışanı, erişebildiği depolarda stok sayılarını serbestçe değiştirebiliyor. Bu, PRODUCT.md'nin rol ayrımı vaadini ve Admin'in "stok hareketlerinin sahibi" olma ilkesini geçersiz kılıyor. **Düzeltme önerisi:** `stock.controller.ts:68`'den `Role.USER`'ı kaldır, `StockStepper`'ı sadece `canAdjustStock=true` (Admin/Platform Admin) durumunda mount et ve User paneline hiç göndermeyecek şekilde ayır.

---

## 1. Kullanıcı Paneli (`apps/web/src/app/(user)/`)

### Salt-okunur ihlali
- Yukarıdaki çapraz bulguya ek olarak: `WarehouseTabs` bileşeni (`components/products/warehouse-tabs.tsx`) rename/create/delete/drag-reorder gibi tüm admin mutasyon kodunu (satır 57-121, 240-317) User paneline de gönderiyor — kullanılmıyor ama bundle'da mevcut, gelecekte yanlışlıkla açığa çıkma riski taşıyor (`canAdjustStock` olayıyla aynı kalıp).

### Boş durumlar ("empty state") öğretmiyor, sessiz kalıyor
- `warehouse-tabs.tsx`: kullanıcının hiç deposu yoksa (`warehouses.length === 0`, ki `warehouse-scope.ts:21-22` üzerinden ulaşılabilir bir durum), tüm koşullu bloklar `warehouses.length > 0` şartına bağlı olduğundan sayfa sadece başlık + boş alan gösteriyor. DESIGN.md'nin istediği "Henüz... eklenmedi + CTA" tarzı öğretici boş durum hiç yok.

### Yükleme durumları
- `apps/web/src/app` altında hiçbir yerde `loading.tsx` yok. `panel/page.tsx:10-13` sunucu tarafında bloklayıcı `serverFetch` çağrıları yapıyor, Suspense/iskelet (skeleton) fallback'i yok — ilk yüklemede tamamen boş ekran.
- `ProductsExplorer` içinde `TableSkeleton` var ama sadece grid görünümü kullanıldığından liste-görünümü iskeleti bu panelde hiç test edilmiyor.

### Hata yönetimi
- `apps/web/src/app` içinde hiçbir yerde `error.tsx` yok. `/panel`'de bir API hatası (`serverFetch` → `ApiError`) yakalanmadan Next'in genel hata ekranına düşüyor, tasarlanmış bir "bir şeyler ters gitti" durumu yok.

### PRODUCT.md'nin ima ettiği ama olmayan görünümler
- Kritik bir ürüne bakan depo çalışanı için trend/geçmiş görünümü yok — `TrendChart` sadece Admin'in ürün detay sayfasına bağlı, User tarafında ürün detay/drill-down sayfası hiç yok.
- Sayfalama yok: `products-explorer.tsx:78` sabit `limit=100` kullanıyor, 100'den fazla ürün olan depoda geri kalanlar hiçbir uyarı olmadan listeden düşüyor.

### Erişilebilirlik
- Ürün arama `Input`'unun (`products-explorer.tsx:158-163`) `aria-label`'ı yok — sadece placeholder var, yazı girilince erişilebilir isim kayboluyor.
- Kritik durum rozetleri (Badge) ikon+renk+metin üçlüsünü doğru kullanıyor — bu kısım DESIGN.md'ye uygun.

### Diğer
- `mergeByName` (`lib/merge-products.ts:20-22`) "Bütün Ürünler" birleşik satırında depolar arası `criticalLevel`'ları toplamak yerine tek bir temsilci üründen değer alıyor — birleşik kritik sayısı (`totalCritical`, `warehouse-tabs.tsx:129`) yanlış olabilir. Tek işi "güvenilir özet göstermek" olan bir rol için bu ciddi bir doğruluk sorunu.

---

## 2. Admin Paneli (`apps/web/src/app/(admin)/`)

### CRUD eksikleri
- **Kategori yönetimi neredeyse yok:** `apps/api/src/products/categories.controller.ts` sadece `GET`/`POST` destekliyor, `PATCH`/`DELETE` yok. Üstelik Admin UI'ı hiç `POST /categories` çağırmıyor — `product-form-modal.tsx:188-197` sadece mevcut kategorilerden seçim sunuyor, "yeni kategori ekle" seçeneği yok. Kategori yönetimi fiilen ulaşılamaz durumda.
- `leadTimeDays`/`safetyMarginDays` alanları API DTO'sunda var ve kritik seviye önerisi algoritmasını doğrudan besliyor (`create-product.dto.ts:24-32`), ama `ProductFormModal`'ın zod şeması bunları hiç göstermiyor (`product-form-modal.tsx:16-23`) — admin öneri parametrelerini hiç ayarlayamıyor, sabit varsayılan (5/3 gün) ile sıkışıp kalıyor.

### Stok hareketi
- Kaydedilmiş bir hareketi düzenleme/silme/geri alma imkanı hiç yok — `stock.controller.ts:41-80` sadece `GET`, `POST`, `PATCH :id/apply-suggestion` sunuyor.
- **Hata:** "Düzeltme (sayım)" (ADJUSTMENT) tipi, IN ile fonksiyonel olarak aynı çalışıyor. `stock.service.ts:56`: `delta = type === OUT ? -qty : qty` — ADJUSTMENT için ayrı bir dal yok, oysa bu tip sadece Admin'e kısıtlanmış (`stock.service.ts:48-51`), yani "mutlak sayım" olarak tasarlanmış görünüyor ama öyle davranmıyor.
- Ürün detayında son hareketler `limit=15` ile sınırlı (`product-detail.tsx:48-52`), "tümünü gör" bağlantısı veya sayfalama yok.

### Arama/filtre/sıralama/sayfalama
- Ürün listesinde sıralama kontrolü yok, sabit `limit=100` — sayfalama gerçek anlamda çalışmıyor.
- `/admin/movements` sayfalanıyor ama ürün/tip/tarih filtresi hiç yok (ürün listesinde arama varken burada yok — tutarsızlık).
- `/stock/alerts` (dashboard) tüm eşleşen satırları sınırsız döndürüyor.

### Form tutarlılığı
- `ProductFormModal`/`UserFormModal` react-hook-form + zod kullanıyor ama `MovementModal` ve `DuplicateProductModal` ham `useState` ile yazılmış — tutarsız. `movement-modal.tsx:96`'da içeriksiz bir `FieldError` çağrısı var (ölü markup).

### Tasarım ilkesi ihlalleri
- DESIGN.md modal'ları sadece "yıkıcı onay + hızlı oluşturma" için istiyor, düzenlemenin satır-içi (inline) olmasını istiyor — ama tam ürün düzenleme (isim, kategori, kritik seviye) hem `/admin/products` hem `/admin/products/[id]`'de aynı modal ile açılıyor, hiçbir yerde inline değil.
- `admin/products/page.tsx:21-46`: sayfa başlığı düzenlenebilir görünüyor ama hiçbir API'ye kaydedilmiyor — sayfa yenilenince sıfırlanan, dekoratif/işlevsiz bir alan.

### Audit log görünürlüğü
- `/admin/activity` sadece **User** rolünün eylemlerini gösteriyor (`audit-log.controller.ts:24-28`, `actorRoles: ['USER']` filtresi). Admin'in kendi ürün/depo/stok işlemleri audit log'a yazılıyor ama panelin hiçbir yerinde Admin'e kendi geçmişi gösterilmiyor.

### Doğru çalışan kısımlar (referans için)
- Ürün/depo/kullanıcı silme işlemleri `ConfirmModal` ile korunuyor, kendi kendini silme engelleniyor.
- Görsel yükleme, ürün kopyalama, sürükle-bırak sıralama uçtan uca gerçek şekilde çalışıyor (ölü kod değil).
- Toast (sonner) ve iskelet yükleme tutarlı şekilde kullanılıyor.

---

## 3. Developer / Platform Admin Paneli (`apps/web/src/app/(developer)/`)

### Riskli işlemlerde "bilinçli sürtünme" yok (DESIGN.md ilke 2 ihlali)
- Kullanıcı **silme** `ConfirmModal` üzerinden gidiyor ama **rol değiştirme** sadece bir `<Select>` — isim/şifre ile aynı formda, düz "Kaydet" butonuyla gönderiliyor (`user-form-modal.tsx:174-181,217-224`). PRODUCT.md rol değişikliğini açıkça yüksek riskli işlem olarak tanımlıyor ama ayrı bir onay adımı yok.

### Silme onayı, etki alanını göstermiyor
- Kullanıcı silme onayı (`users-manager.tsx:316-319`) sadece "bu hesabı sil?" diyor; `Warehouse.owner` ilişkisi `onDelete: Cascade` (`schema.prisma:35`) olduğundan bir Admin silindiğinde **tüm depoları ve ürünleri de siliniyor** — bu hiç belirtilmiyor. Oysa depo silme onayı (`warehouse-tabs.tsx:326`) "...ve içindeki N ürünü de sil" diyerek bunu doğru yapıyor — aynı şeffaflık kullanıcı silmede yok.
- `managedUsers` (User hesapları) olan bir Admin silinirse, bu durum uygulama seviyesinde kontrol edilmiyor (`users.service.ts:201-236`) — ham FK constraint hatası olarak yüzeyebilir, kullanıcı dostu bir mesaj yerine.

### Audit log görüntüleyici "kim ne yaptı" hedefini tam karşılamıyor
- Backend `userId`'ye göre filtrelemeyi destekliyor (`audit-log.controller.ts:22,34`) ama `developer/logs/page.tsx:15,42-53` sadece **kaynak (resource)** filtresi sunuyor — kullanıcı filtresi, tarih aralığı filtresi UI'da yok. PRODUCT.md'nin başarı kriteri tam olarak "platform admin kim ne yaptı sorusunu audit log'dan çözebilmeli" — bu eksik.

### "Salt-okunur" etiketi yanıltıcı
- `warehouses/[id]/page.tsx:50` ve `OwnerWarehousesView` (satır 104) "salt okunur görünüm" diyor ama `canManagePhoto` prop'u geçiliyor ve gerçek bir `PhotoUploadButton` mutasyonu render ediliyor (`product-card.tsx:74`) — etiketle davranış çelişiyor.
- Depo **düzenleme/silme** developer panelinden hiç yapılamıyor — sadece "Yeni Depo" oluşturma var (`warehouses/page.tsx:108-111`). Admin panelindeki `WarehouseTabs` bileşeni rename/delete/reorder'ı zaten destekliyor ama burada yeniden kullanılmamış; backend zaten izin veriyor (`warehouses.controller.ts:49-63`).

### Sayfalama/arama eksik
- `UsersManager` tüm kullanıcıları filtresiz çekiyor (`users-manager.tsx:81`), arama kutusu ve sayfalama yok.
- `developer/warehouses/page.tsx` sahibe göre gruplanmış ama arama/filtre yok.

### Hata durumları
- Panelin hiçbir yerinde `error.tsx`/`loading.tsx` yok; client sayfalar (`logs`, `warehouses`, `warehouses/[id]`, `products`) `useQuery`'den sadece `isLoading` alıyor, `isError` hiç kullanılmıyor — başarısız istek sessizce `undefined` alanlar gösteriyor.

### Doğru çalışan kısımlar (referans için)
- Sistem geneli Ürünler sayfası (`developer/products/page.tsx`) tamamen salt-okunur ve eksiksiz — Admin ile CRUD çakışması yok, doğru kapsamlı.
- Son Platform Admin'i silme/rol düşürme koruması ve kendi kendini kilitleme koruması gerçekten var (`users.service.ts:122-145,217-226`).
- Rol değişikliği anında etkili oluyor — `JwtStrategy.validate()` her istekte kullanıcıyı DB'den tazeliyor (`jwt.strategy.ts:25-33`), token yenilemeyi beklemiyor.

---

## 4. API / Backend (`apps/api/src/`)

### Kimlik doğrulama (auth)
- **Refresh token rotasyonu/iptali yok:** `auth.service.ts:58-76` `refresh()` sadece JWT'yi tekrar doğrulayıp yeni çift üretiyor — DB'de tutulan bir refresh-token tablosu, jti/blacklist yok. Çalınan bir refresh token, "logout" sonrası bile 7 günlük TTL boyunca geçerli kalıyor.
- **Logout endpoint'i hiç yok** — `auth.controller.ts` sadece `login`, `refresh`, `me` içeriyor.
- **Şifre sıfırlama / "şifremi unuttum" akışı hiç yok** — tek yol bir Admin/Platform Admin'in `PATCH /users/:id` ile başkasının şifresini değiştirmesi (self-servis değil).
- Login endpoint'inde **rate limiting yok** (`@nestjs/throttler` bağımlılığı yok) — brute-force'a açık.

### Yetkilendirme
- Genel olarak sağlam: her controller'da `@UseGuards(JwtAuthGuard, RolesGuard)` ve her mutasyon metodunda `@Roles(...)` var.
- **Tek istisna, en kritik olanı:** `stock.controller.ts:68` `POST /stock/movements`, `Role.USER`'a da açık — bkz. yukarıdaki "En kritik bulgu" bölümü.

### Sayfalama
- Ürünler, stok hareketleri ve audit log'lar sayfalanıyor. **`users.controller.ts:27-30` `GET /users` sayfalanmıyor** — tüm kullanıcı listesi sınırsız dönüyor.

### Kategori modülü
- `PATCH`/`DELETE` yok (yukarıda Admin panelinde de bahsedildi). Ayrıca `findAll` tamamen kapsam-dışı/global — herhangi bir kimliği doğrulanmış kullanıcı tüm sahiplerin kategori isimlerini görebiliyor (düşük şiddetli ama gerçek bir çapraz-kiracı sızıntısı).

### Test kapsamı
- **Sıfır test dosyası.** `apps/api/src` içinde hiçbir `*.spec.ts` yok; `package.json`'da jest scriptleri tanımlı ama karşılığı yok.

### Görsel yükleme
- MIME tipi ve 5MB boyut kontrolü var (iyi), ama **yetim dosya temizliği yok**: `products.service.ts` `setImage` eski görseli diskte bırakıyor, `remove` ürünü silerken görsel dosyasını silmiyor — zamanla disk sızıntısı.

### Güvenlik sertleştirme eksikleri
- `helmet` yok, rate limiting yok, özelleştirilmiş exception filter yok (Nest'in varsayılanına güveniliyor).

### Doğru çalışan kısımlar (referans için)
- Stok/audit doğruluğu sağlam: her stok mutasyonu `$transaction` içinde hem `StockMovement` satırı hem `Product.currentStock` güncellemesi yapıyor, ardından audit log yazıyor — "gerçek veri, gerçek kaynak" ilkesine uygun.
- Kritik seviye önerisi gerçek bir algoritma (ağırlıklı ADC formülü + gece yarısı cron job'u ile yeniden hesaplama) — stub değil.
- Depo bazlı çok-kiracılı kapsamlama (`warehouse-scope.ts`) tutarlı şekilde uygulanmış, ciddi bir sızıntı bulunamadı.
- Girdi doğrulama (class-validator) ve global `whitelist`/`forbidNonWhitelisted`/`transform` neredeyse her yerde var.

---

## Öncelik Sırası (önerilen)

1. **Kritik / güvenlik:** `POST /stock/movements`'tan `Role.USER`'ı kaldır + User panelindeki `StockStepper`/mutasyon UI'larını tamamen kaldır.
2. **Güvenlik:** Login rate limiting, refresh-token iptali/logout endpoint'i, şifre sıfırlama akışı.
3. **Veri bütünlüğü:** ADJUSTMENT hareket tipinin gerçek "mutlak sayım" davranışı, kullanıcı silmede cascade uyarısı, kategori CRUD'unun tamamlanması.
4. **Kullanılabilirlik:** `error.tsx`/`loading.tsx` eklenmesi, tüm liste görünümlerine sayfalama/arama, audit log'a kullanıcı+tarih filtresi.
5. **Cila:** Inline düzenleme (modal yerine), admin'e kendi audit geçmişinin gösterilmesi, depo düzenleme/silmenin developer paneline eklenmesi, form tutarlılığı (react-hook-form her yerde).
6. **Teknik borç:** API için test paketi yazılması, görsel dosya temizliği, kritik seviye öneri parametrelerinin (`leadTimeDays`/`safetyMarginDays`) admin UI'da açığa çıkarılması.
 