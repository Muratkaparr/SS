# Product

## Register

product

## Users

Üç kullanıcı tipi var, hepsi aynı depo/envanter verisine bakıyor ama farklı yetkilerle:

- **Kullanıcı (User)**: Depo/operasyon çalışanı. Sisteme sadece bakar — ürün durumunu, stok seviyelerini, kritik uyarıları görür. Hiçbir düzenleme yapamaz. Muhtemelen gün içinde hızlıca göz atıp çıkacak, teknik altyapıyla ilgilenmeyen bir kullanıcı.
- **Admin**: Depo yöneticisi. Ürün ekleyip düzenler, stok hareketi girer, kritik seviyeleri onaylar. Günün büyük kısmını bu panelde geçirebilir — formlar, tablolar, hızlı arama onun için birincil işler.
- **Platform Admin ("Developer Paneli")**: Sistem sahibi/süper kullanıcı. Kullanıcı hesaplarını yönetir, sistem loglarını izler, yetki değiştirir. Nadiren ama yüksek-riskli işlemler yapar (kullanıcı silme, rol değiştirme).

## Product Purpose

İnternet üzerinden çalışan bir depo/envanter takip sistemi: ürünlerin QR/barkod ile tanımlanması, stok adetlerinin gerçek zamanlı takibi, kritik stok seviyesi altına düşen ürünler için uyarı, günlük/haftalık tüketim trendine göre kritik seviye önerisi. Başarı: bir depo yöneticisinin "hangi ürün tükeniyor, ne zaman sipariş vermeliyim" sorusuna saniyeler içinde cevap bulabilmesi; bir platform adminin "kim ne yaptı" sorusunu audit log'dan çözebilmesi.

## Brand Personality

Sıcak & erişilebilir, ama ciddiyetini kaybetmeyen: **güvenilir, sade, davetkar**. Depo çalışanları teknik geçmişi olmayan kullanıcılar olabilir — arayüz onları ürkütmemeli, karmaşık bir ERP gibi hissettirmemeli. Yine de bu bir iş aracı: gösterişten çok netlik öncelikli.

## Anti-references

- Jenerik "AI SaaS" şablonu: gradient text, yığın halinde özdeş kartlar, mor/mavi gradyan hero, uçlarda süslü ikon setleri.
- Eski moda / sıkışık masaüstü ERP tabloları (yoğun, düşük kontrastlı, teknik jargonla dolu) — bu his de istenmiyor, veri yoğun olsa da nefes alan bir düzen gerekiyor.
- Side-stripe border'lı kartlar, tekdüze eyebrow etiketler, sahte "01/02/03" numaralı bölüm başlıkları.

## Design Principles

1. **Netlik yoğunluğa üstündür.** Veri çok (ürün listeleri, hareket geçmişi, loglar) ama her ekran tek bir birincil işi net şekilde öne çıkarmalı.
2. **Rol, arayüzün şeklini belirler.** Kullanıcı paneli sakin ve salt-okunur hissettirmeli (aksiyon çağrısı yok); Admin paneli aksiyon-öncelikli (form/CRUD hızlı erişilebilir); Platform Admin paneli riskli işlemlerde bilinçli sürtünme taşımalı (onay adımları görsel olarak da ağırlıklı hissettirilmeli).
3. **Kritiklik görünür olmalı, alarmist olmadan.** Kritik stok uyarısı gözden kaçmamalı ama tüm arayüzü kırmızıya boğmamalı — durum rengi anlamlı ve tutarlı kullanılmalı.
4. **Gerçek veri, gerçek kaynak.** Stok geçmişi bir ledger'dan geliyor; UI bunu "şu an X, geçmişte şöyle değişti" şeklinde şeffaf anlatmalı, sihirli/kara kutu hissettirmemeli.
5. **Sıcak ama iş odaklı.** Renk ve tipografi davetkar olsun, ama dekoratif olmasın — her renk bir duruma (normal/kritik/uyarı) veya hiyerarşiye karşılık gelmeli.

## Accessibility & Inclusion

- WCAG AA hedefi: metin kontrastı ≥4.5:1, büyük başlıklar ≥3:1.
- Hem açık hem koyu tema desteklenecek (kullanıcı tercihi, sistem tercihine varsayılan).
- `prefers-reduced-motion` desteği zorunlu.
- Kritik stok durumu sadece renkle değil, ikon/etiketle de belirtilecek (renk körlüğü için).
