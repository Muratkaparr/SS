# Eksikler ve Bulgular (2. Denetim — 2026-07-13)

> Bu dosya EKSIKLER.md'nin ilk halinin (commit `aabd853`) üzerine yapılan düzeltmelerden ve ardından gelen "Depo hiyerarşisi, taşıma ve ürün hızlı işlemleri" (commit `c4c0857`) ile "kritik stok uyarısında depo gösterimi" (commit `d004830`) özelliklerinden sonra yapılan ikinci, baştan sona denetimdir. Kod tabanının tamamı (3 panel + API backend) dört bağımsız ajanla tekrar taranmış; hem eski maddelerin gerçekten düzelip düzelmediği (regresyon kontrolü) hem de hiç denetlenmemiş yeni depo-hiyerarşisi/erişim kodu incelenmiştir. Dosya yolları ve satır numaraları verildiği yerde kod anında bulunabilir.

---

## 🔴 En kritik / çapraz bulgu: Depo erişim kısıtı `GET /warehouses/:id`'de delik veriyor (IDOR)

Bu bulgu **iki ayrı ajan tarafından bağımsız olarak** (biri backend'i, biri User panelini denetlerken) tespit edildi:

- `apps/api/src/warehouses/warehouses.service.ts:98-106` (`findOne`) yetki kontrolü için `assertOwnership()` (`:301-307`) çağırıyor — bu fonksiyon sadece `warehouse.ownerId === actor.adminOwnerId` bakıyor, yani "bu depo senin Admin'inin havuzunda mı" sorusuna cevap veriyor.
- Oysa granüler depo-bazlı kısıtlama için yazılmış `assertWarehouseAccess()` (`apps/api/src/common/utils/warehouse-scope.ts:150-161`) bu serviste **hiç çağrılmıyor**. `findAll`, `products.service.ts`, `stock.service.ts` bu fonksiyonu doğru kullanıyor — sadece `warehouses.findOne` deseni kaçırmış.
- Controller'da bu endpoint için rol kısıtı da yok (`warehouses.controller.ts:50-53`), yani herhangi bir kimliği doğrulanmış USER çağırabilir.

**Etkisi:** `WarehouseAccess` ile sadece belirli bir depoya kısıtlanmış bir User, aynı Admin'in havuzundaki **erişimi olmayan** bir deponun id'sini elde ederse (URL'den, breadcrumb'dan, ürün detayından vb.) `/panel/products/warehouse/<yetkisiz-id>` üzerinden depo adını, `ownerName`, `productCount`, `criticalCount`, `childCount` gibi meta verileri görebiliyor. Ürün/stok verisi diğer servisler doğru filtrelendiği için sızmıyor (403), ama deponun varlığı ve özeti sızıyor — "sadece izin verilen depolara erişim" vaadinin doğrudan ihlali.

**Düzeltme önerisi:** `warehouses.service.ts:findOne` içinde Role.USER için `assertWarehouseAccess(actor, id)` çağır (diğer servislerle aynı desen).

---

## 1. Kullanıcı Paneli (`apps/web/src/app/(user)/`)

### Regresyon kontrolü (eski bulgular)
- ✅ **Salt-okunuş ihlali gerçekten kapatılmış.** `user-products-page-content.tsx` artık `canManage`/`canAdjustStock`/`canManagePhoto`/`onEdit`/`onDelete` gibi hiçbir mutasyon prop'unu geçmiyor; `StockStepper`/`PhotoUploadButton` User'da mount olmuyor. Backend'de de ikinci kat savunma var: `POST /stock/movements` artık sadece `Role.ADMIN`.
- ✅ **`loading.tsx`/`error.tsx` gerçek ve anlamlı** (`PageSkeleton`, "Tekrar dene" butonlu `ErrorState`). Ama bu yalnızca sunucu/throw edilen hataları yakalıyor — client-side `useQuery` hataları error boundary'ye düşmüyor (aşağıya bkz.).

### Yeni bulgular (depo hiyerarşisi ile gelen kod)
- 🔴 Yukarıdaki çapraz IDOR bulgusunun User panelindeki somut yansıması: yetkisiz depo id'si ile meta veri sızıyor.
- 🟠 **Silinen/taşınmış depo URL'i sessizce boş ekrana düşüyor.** Bir Admin depoyu silerse/taşırsa, o depoyu görüntüleyen/yer imlemiş bir User için: `/warehouses/:id` 404 döner → context zinciri (`use-warehouse-context.ts`) `lastWarehouse=null` üretir → `WarehouseTabs` var olmayan bir `parentId` ile sorgulamaya devam eder → boş liste, hiçbir `EmptyState` yok, breadcrumb'da sadece `"…"` görünür. `useQuery` hata fırlatmadığı için `error.tsx` da tetiklenmiyor — kullanıcı açıklamasız boş bir sayfada kalıyor.
- 🟠 **Sabit `limit=100`, gerçek sayfalama yok** (`warehouse-tabs.tsx:58`, `products-explorer.tsx:85`). `Paginated<T>` backend'den geliyor ama UI yok sayıyor; 100+ ürünlü depoda ürünler sessizce kesiliyor, "Bütün Ürünler" kritik rozeti de bu eksik veriden hesaplandığı için yanlış çıkabilir.
- 🟠 **`mergeByName` kritik sayım hatası derinleşti.** Aynı isimli ürünler birleşirken `criticalLevel` toplanmıyor, tek bir temsilci depodan alınıyor (`lib/merge-products.ts:18-34`). Hiyerarşi derinleştikçe (Ana Depo + N alt depo) aynı isimli ürünlerin farklı dallarda bulunma ihtimali arttığından bu yaklaşım gerçek toplam kritik durumu daha sık yanlış yansıtıyor.

### Kullanılabilirlik / tasarım ilkesi
- 🟡 Depo yoksa **tamamen sessiz** boş ekran: `warehouse-tabs.tsx` (185-257) `warehouses.length===0` iken hiçbir şey render etmiyor; sidebar'da `warehouse-tree-nav.tsx:238` aynı şekilde `return null`. DESIGN.md'nin istediği öğretici boş durum ("Henüz... eklenmedi + CTA") burada yok — oysa dashboard'da (`panel/page.tsx:44-49`) doğru örneği var.
- 🟡 Ürün arama boş durumu bağlamdan bağımsız: depo gerçekten boşken de, arama sonucu boşken de aynı "Arama kriterlerinizi değiştirmeyi deneyin" metni çıkıyor (`products-explorer.tsx:219-226`).
- 🟡 Erişilebilirlik: aktif depo/sekme sadece renkle işaretleniyor, `aria-selected`/`aria-current`/`role="tree"` yok — sınırsız derinlikli ağaçta bu artık daha önemli. Arama input'unun `aria-label`'ı hâlâ yok.

### Doğru çalışan kısımlar
- Salt-okunuşluk artık iki katmanlı gerçekten korunuyor (UI prop'ları + backend rol kontrolü).
- Sınırsız derinlik hiyerarşi yapısal olarak doğru çalışıyor (özyinelemeli render + sınırsız BFS backend'de).
- Ürün/stok listeleme uçları `WarehouseAccess`'i doğru uyguluyor (sadece `warehouses.findOne` istisna).

---

## 2. Admin Paneli (`apps/web/src/app/(admin)/`)

### Regresyon kontrolü (eski bulgular)
- ✅ leadTimeDays/safetyMarginDays artık admin formda var ve doğrulanıyor.
- ✅ ADJUSTMENT artık gerçekten "mutlak sayım" gibi davranıyor, hem `MovementModal` hem backend tutarlı.
- ✅ `error.tsx`/`loading.tsx` var.
- ✅ `MovementModal`/`DuplicateProductModal` artık react-hook-form + zod kullanıyor (ham `useState` kalmamış).
- ⚠️ **Kategori PATCH/DELETE backend'de var ama UI'da hâlâ yok** (kısmi düzelme) — aşağıya bkz.

### Yeni bulgular
- 🟠 **Kategori yönetimi backend'de tam, UI'da erişilemez.** `categories.controller.ts` artık PATCH/DELETE destekliyor ama `product-form-modal.tsx`'teki `<Select>` sadece mevcut kategorileri listeliyor; admin panelinde kategori oluşturma/silme/yeniden adlandırma için hiçbir UI yok. Özellik fiilen kullanılamıyor.
- 🟠 **"Mevcut Stok" güncellemesi atomik değil.** `product-form-modal.tsx:110-137`: önce `PATCH /products/:id`, sonra ayrı bir `POST /stock/movements`. İkinci çağrı başarısız olursa `onSuccess`/`invalidateQueries` hiç tetiklenmiyor — ürün bilgisi sunucuda güncellenmiş olsa bile ekran stale kalıyor, kullanıcı neyin kaydolduğunu bilemiyor.
- 🟠 **İki ayrı, örtüşen stok değiştirme yolu var** ("Düzenle" → Mevcut Stok alanı vs. "Stok Hareketi" butonu, `product-detail.tsx:86-95`). İlki her zaman jenerik "hızlı düzenleme" nedeniyle ADJUSTMENT kaydı bırakıyor, IN/OUT ayrımı yapamıyor; alan açıklaması bunun bir ledger kaydı yarattığını hiç belirtmiyor — Hareketler geçmişinde hangi "Düzeltme" kayıtlarının sayımdan hangilerinin buradan geldiği ayırt edilemiyor.
- 🟠 Ürün listesinde User panelindeki ile aynı sorun: sabit `limit=100`, sayfalama yok (`products-explorer.tsx:85`), Hareketler sayfası buna karşın düzgün sayfalanmış — tutarsızlık.

### Kullanılabilirlik / tasarım ilkesi
- 🟡 Tam ürün düzenleme hâlâ modal (isim, kategori, kritik seviye, stok — hepsi aynı `ProductFormModal`). DESIGN.md ilke 2 ("düzenleme inline olmalı") hâlâ ihlal ediliyor.
- 🟡 Depo taşıma, Admin'in asıl çalıştığı ürünler sekme şeridinden değil, sadece sidebar'daki `MoveWarehouseModal`'dan erişilebiliyor — birincil iş akışından kopuk.
- 🟡 Arama input'u debounce'suz, her tuş vuruşunda yeni istek.

### Doğru çalışan kısımlar
- "Hızlı ekle" UX'i net: aynı isimli ürün varsa hata yerine stoğa ekleniyor, kullanıcıya bu açıkça anlatılıyor.
- Depo taşıma döngü koruması istemci ve backend'de birebir aynı mantıkla çalışıyor, UI geçersiz hedefleri baştan gizliyor.
- WarehouseAccess atama (User'ı belirli depolara kısıtlama) uçtan uca çalışıyor, UI'sız-özellik değil.
- Hareketler sayfası düzgün sayfalanmış, iskelet + boş durum doğru kullanılmış.

---

## 3. Developer / Platform Admin Paneli (`apps/web/src/app/(developer)/`)

### Regresyon kontrolü (eski bulgular)
- ✅ Audit log kullanıcı+tarih filtresi eklenmiş, çalışıyor.
- ✅ `error.tsx`/`loading.tsx` var.
- ✅ Son Platform Admin / kendi kendini kilitleme koruması sağlam, doğrulandı.
- ✅ Rol değişikliği JWT'de gerçekten anlık etkili (her istekte DB'den tazeleniyor).
- ⚠️ **Depo düzenle/sil eklenmiş ama "taşı" hâlâ yok** (kısmi düzelme) — aşağıya bkz.
- ⚠️ **Kullanıcı silme onayına cascade metni eklenmiş ama sayısal etki yok** (kısmi düzelme) — aşağıya bkz.
- ⚠️ **Users listesine arama/sayfalama sadece Admin-scoped görünümde eklenmiş**; Developer'ın tam sistem görünümünde arama yok, gerçek server-side sayfalama hiçbir yerde bağlanmamış (`users-manager.tsx` hâlâ sabit `limit=200` ile hepsini çekip client-side filtreliyor) — backend `page`/`search` destekliyor ama kullanılmıyor.
- ❌ **Rol değiştirme hâlâ sıradan `<Select>` + tek "Kaydet" butonu** — düzeltilmemiş, aşağıda tekrar kritik olarak listeleniyor.
- ❌ **`useQuery`'den `isError` hâlâ kullanılmıyor** — düzeltilmemiş.

### Yeni bulgular
- 🔴 **Depo silme onayı, derin hiyerarşide gerçek etkiden çok düşük sayı gösteriyor.** Backend `withStats` (`warehouses.service.ts:309-345`) `childCount`/`productCount` yalnızca **doğrudan** çocukları/ürünleri sayıyor; oysa `Warehouse` kendi üzerinde self-relation `onDelete: Cascade` tanımlıyor, yani silme tüm alt ağacı (torunlar dahil) ve içindeki tüm ürünleri siliyor. Onay diyaloğu (`developer/warehouses/page.tsx:333-338`, `warehouse-tree-nav.tsx:186-190`) bu eksik rakamı gösteriyor — 3+ seviyeli bir ağaçta Platform Admin gerçekte silinecek çok daha fazla depo/ürünü görmeden "Sil"e basabiliyor. (Backend tarafında da aynı kök nedenden ayrıca raporlandı — çapraz doğrulandı.)
- 🔴 **Developer panelinden depo taşınamıyor.** Hiyerarşiyi yönetmesi beklenen rol tam da bunu yapamıyor: sayfa sadece düzenle (isim/konum) ve sil sunuyor, `parentId` değiştirilemiyor; `MoveWarehouseModal` sadece Admin sidebar'ında kullanılıyor, Developer panelinde hiç import edilmemiş. Bir depoyu yeniden ebeveynlemek için tek yol sil-yeniden oluştur — ki bu da yukarıdaki cascade bug'ı yüzünden veri kaybına yol açar.
- 🟠 **"Salt-okunur" etiketi hâlâ yanıltıcı.** `warehouses/[id]/page.tsx:50` "salt okunur görünüm" diyor ama `canManagePhoto` geçiliyor, gerçek bir `PhotoUploadButton` mutasyonu render ediliyor.
- 🟠 **Admin silme onayında cascade sayısal değil.** `users.service.ts` `remove()` yalnızca bağlı USER sayısını (`managedUserCount`) hesaplıyor; kaç depo/ürün silineceğini hiç hesaplamıyor/göstermiyor — jenerik metin var ama somut sayı yok.

### Tasarım ilkesi ihlalleri (yüksek öncelik)
- 🟡 **Riskli işlemde bilinçli sürtünme yok:** rol değiştirme, isim/aktiflik gibi sıradan alanlarla aynı formda aynı "Kaydet" butonuyla gönderiliyor. DESIGN.md ilke 2'nin talep ettiği görsel olarak ağır, ayrı bir onay adımı yok.
- 🟡 **WarehouseAccess ağacı checkbox UX'i tutarsız:** üst depo işaretlenince alt node'lar backend'de otomatik dahil oluyor ama UI'da checked görünmüyor (`warehouse-check-tree.tsx`) — denetleyen bir Admin, checkbox görünümünden yanlış "kim hangi depoya erişebiliyor" sonucu çıkarabilir.
- 🟡 Developer'ın tam sistem kullanıcı görünümünde arama/sayfalama yok.

### Doğru çalışan kısımlar
- Audit log filtreleri + gerçek server-side sayfalama tam çalışıyor.
- Son Platform Admin koruması ve kendi kendini kilitleme backend'de sağlam.
- Rol değişikliği gerçekten anlık etkili (JWT her istekte DB'den tazeleniyor).
- Depo oluşturma/taşıma döngü koruması iyi tasarlanmış (mevcut olduğu yerlerde).

---

## 4. API / Backend (`apps/api/src/`)

### Regresyon kontrolü (eski bulgular)
- ✅ Refresh token rotasyonu + gerçek logout eklenmiş (`RefreshToken` tablosu, jti bazlı iptal). Küçük eksik: reuse tespit edildiğinde sadece o token reddediliyor, kullanıcının diğer aktif oturumları otomatik iptal edilmiyor — pasif tespit.
- ✅ Self-servis şifre değiştirme, login rate limiting (`@Throttle`) eklenmiş.
- ✅ ADJUSTMENT mutlak sayım davranışı doğru.
- ✅ `POST /stock/movements` artık sadece `Role.ADMIN`.
- ✅ Kategori PATCH/DELETE eklenmiş — ama `findAll()` hâlâ tamamen global/kapsamsız, eski cross-tenant kategori-isim sızıntısı düzelmemiş.
- ✅ Users pagination eklenmiş (`page`/`limit`).
- ⚠️ Kullanıcı silmede cascade uyarısı kısmi: `managedUserCount` kontrolü var ama depo/ürün sayısı hesaplanmıyor, API dry-run/etki bilgisi döndürmüyor.

### Yeni bulgular
- 🔴 **IDOR — `GET /warehouses/:id` `WarehouseAccess`'i atlıyor.** Detaylar en üstteki çapraz bulguda.
- 🔴 **Stok hareketlerinde "lost update" / stale-read yarış durumu.** `stock.service.ts:47`: `product` transaction **öncesi** okunuyor, `nextStock` bu bayat değerden hesaplanıp (`:55-70`) transaction içine mutlak değer olarak yazılıyor (`{increment: delta}` değil, doğrudan `set`). İki eşzamanlı istek aynı `currentStock`'u okursa biri kaybolur. Daha ciddisi: "yetersiz stok" kontrolü de bu bayat veriye dayandığından, iki paralel OUT isteği stoğu **negatife düşürebilir** (overselling) — DESIGN.md'nin "gerçek veri, gerçek kaynak" ilkesiyle çelişen bir tutarsızlık riski. `duplicate()` aynı `createMovement`'ı çağırdığı için hızlı-ekle de aynı riski taşıyor.
- 🟠 **Hızlı ekle: farklı kategoriye/birime sahip aynı isimli ürün sessizce birleştiriliyor.** Eşleşme sadece `warehouseId + name` üzerinden (`products.service.ts:357-394`), kategori/birim karşılaştırılmıyor.
- 🟠 **Hızlı ekle: existence-check + create transaction dışı.** Eşzamanlı iki istekte unique constraint ikinci isteği 500 ile çökertebiliyor, zarif bir "stoğa ekle"ye düşmüyor.
- 🟡 Kategori `findAll` hâlâ scope'suz — herhangi bir kimliği doğrulanmış kullanıcı tüm sahiplerin kategori isimlerini görebiliyor.
- 🟡 Refresh token reuse tespiti pasif (yukarıda detaylandırıldı).
- 🟡 Küçük rol tutarsızlığı: ürün create/update/delete sadece `Role.ADMIN`, ama `uploadImage` hem `ADMIN` hem `PLATFORM_ADMIN`'e açık.

### Test kapsamı
- Test paketi genişletilmiş (50+ test) ama `warehouse-scope.spec.ts` sadece mutlu-yol senaryolarını kapsıyor: `assertWarehouseAccess` hiç test edilmemiş, `getAccessibleWarehouseIds`'in ADMIN/PLATFORM_ADMIN dalları ve `includeInParentTotal=false` etkisi test edilmemiş — yukarıdaki IDOR bug'ı bir testle yakalanabilirdi.

### Doğru çalışan kısımlar
- "Mevcut Stok" hızlı düzenlemesi gerçekten ledger'a (`StockMovement`) yazıyor, `Product.currentStock`'u sessizce değiştirmiyor — DESIGN.md ilke 4 korunuyor.
- Depo taşıma: döngü tespiti, kendine taşıma engeli, "son ana depo" koruması, isim çakışması kontrolü derin ağaçlarda da doğru çalışıyor.
- `products`/`stock` servislerinde `assertWarehouseAccess`/`getAccessibleWarehouseIds` tutarlı uygulanmış — sadece `warehouses.findOne` istisna.

---

## Öncelik Sırası (önerilen)

1. **Kritik / güvenlik:** `warehouses.service.ts:findOne`'a `assertWarehouseAccess` ekle (IDOR); stok hareketi yazımını transaction içi güncel okumaya/`increment`e taşıyarak yarış durumunu (overselling riski) kapat.
2. **Veri bütünlüğü:** Derin hiyerarşide silme istatistiklerini (`withStats` + onay diyalogları) recursive hesapla; hızlı-eklede kategori/birim eşleşmesini kontrol et ve existence-check+create'i transaction'a al.
3. **Riskli işlem sürtünmesi:** Developer panelinde rol değiştirmeye ayrı, görsel olarak ağır bir onay adımı ekle.
4. **Kullanılabilirlik:** Ürün listelerinde (User+Admin) ve Developer kullanıcı listesinde gerçek sayfalama bağla; silinen/taşınmış depo URL'inin sessiz boş ekrana düşmesini anlamlı bir hata/empty state'e çevir; boş depo durumlarına öğretici empty state ekle.
5. **Cila:** Kategori yönetim UI'sı (backend hazır, UI yok); `mergeByName` kritik toplam düzeltmesi; "salt-okunur" etiketinin `canManagePhoto` ile çelişmesini gider; admin/developer silme onaylarına gerçek sayısal etki ekle; Developer panelinden depo taşımayı mümkün kıl; iki farklı stok-değiştirme yolunu (ProductForm vs MovementModal) birleştir/ayrıştır.
6. **Teknik borç:** `warehouse-scope.spec.ts`'e eksik senaryoları (assertWarehouseAccess, ADMIN/PLATFORM_ADMIN dalları) ekle; kategori `findAll`'ı scope'la; refresh-token reuse tespitini aktif oturum iptaline bağla; `useQuery` çağrılarında `isError` işle.
