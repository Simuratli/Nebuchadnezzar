# Zaman Atlası

Kafkasya, Osmanlı coğrafyası ve İpek Yolu için (MÖ 500 – MS 1950) harita ve zaman çizelgesi tabanlı tarih uygulaması. Bir yıl seçin; harita o yılın sınırlarını ve olaylarını göstersin. Her olay kaynaklıdır ve APA 7, Chicago veya BibTeX olarak kopyalanabilir.

## Kurulum

Node.js 20 veya üzeri gerekir.

```bash
npm install
npm run dev        # http://localhost:3000
```

Seed verisi ve sınır dosyaları repoda hazır gelir, ek ayar gerekmez.

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi ve sunucusu |
| `npm run lint` | ESLint |
| `npm test` | Vitest birim testleri |
| `npm run test:e2e` | Playwright testleri (önce `npm run build` ve `npx playwright install chromium`) |

`next dev` ve `next build` aynı `.next` klasörünü kullanır; aynı anda çalıştırmayın.

## Veri

### Olaylar: `npm run data:wikidata`

`scripts/fetch-wikidata.ts`, Wikidata SPARQL ve Vikipedi API'sinden `data/seed/events.json`, `sources.json` ve `people.json` dosyalarını üretir.

- Sorgu sonuçları `.cache/wikidata/` altında tutulur. Yarıda kesilirse yeniden çalıştırmak kaldığı yerden sürdürür. Güncel veri için bu klasörü silin.
- Wikidata yoğunken zaman aşımı olağandır. Script yeniden dener; yine de başarısız olan dilimler `ATLANDI` satırıyla günlüğe yazılır ve o dilimin adayları eksik kalır.
- İstekler sıralıdır. Aynı anda birden fazla kopya çalıştırmayın.
- Rotalar (`routes.json`) ve turlar (`tours.json`) elle yazılmıştır, script bunlara dokunmaz. Göç olaylarının çizgileri `data/manual/migrations.json`, kişi listesi `data/manual/people.json` dosyasındadır.

### Sınırlar: `npm run data:boundaries`

`scripts/prepare-boundaries.ts`, [historical-basemaps](https://github.com/aourednik/historical-basemaps) dosyalarını indirir, mapshaper ile sadeleştirir ve `public/data/boundaries/` altına manifest ile birlikte yazar. Seçilen yıl için, o yıldan önceki en yakın dosya gösterilir.

### Veri güvenilirliği

- **`needs_review: true`** kayıtlar arayüzde uyarıyla gösterilir. Türkçe olmayan metinler, özeti olmayan olaylar, elle çizilen göç çizgileri, tüm rotalar ve tur metinleri bu gruptadır.
- **Rotalar ve tur** genel bilgiyle yazılmıştır, kaynak içermez. Akademik kullanımdan önce uzman kontrolü gerekir.
- **Wikidata ve Vikipedi kaynakları** `reliability: 1` (en düşük) taşır. Akademik kaynaklar `data/seed/sources.json` dosyasına elle eklenebilir. Uydurma kaynak eklemeyin; bilinmeyen alanları `null` bırakın.
- **Yıllar** tarihsel sayımla tutulur: negatif değer MÖ'dür ve yıl 0 yoktur.
- **Sınırlar yaklaşıktır.** Veri setinin kendisi de akademik kullanımdan önce başka kaynaklarla karşılaştırılmasını önerir. Kesik çizgi, veri setinde "yaklaşık" işaretli sınırı gösterir.

## Supabase'e geçiş

Uygulama varsayılan olarak seed dosyalarıyla çalışır. Veri erişimi `src/lib/data/repository.ts` arayüzünün arkasındadır.

> **Bu yol henüz canlı veritabanında test edilmedi.** Migration, yükleyici ve adaptör yazıldı, ancak geliştirme ortamında Docker ve Supabase projesi olmadığı için uçtan uca çalıştırılmadı. İlk geçişte aşağıdaki adımları doğrulayarak ilerleyin.

1. [Supabase](https://supabase.com) üzerinde bir proje oluşturun.
2. Şemayı uygulayın:
   ```bash
   supabase link --project-ref <proje-ref>
   supabase db push
   ```
3. `.env.example` dosyasını `.env.local` olarak kopyalayıp değerleri doldurun. `SUPABASE_SERVICE_ROLE_KEY` satır düzeyi güvenliği aşar; tarayıcıya gitmemeli, `NEXT_PUBLIC_` önekiyle tanımlanmamalıdır.
4. Veriyi yükleyin (yeniden çalıştırılabilir, kayıtlar `id` ile güncellenir):
   ```bash
   node --env-file=.env.local --import tsx scripts/load-supabase.ts
   ```
5. `.env.local` içinde `DATA_SOURCE=supabase` yapın ve `npm run build` ile yeniden derleyin. Ana sayfa derleme sırasında üretildiği için veri değişikliklerinin görünmesi de yeniden derleme gerektirir.

Koleksiyonlar şimdilik tarayıcıda (`localStorage`) tutulur. Hesaba bağlamak için `src/lib/collection.ts` içindeki `CollectionStore` arayüzünün Supabase Auth kullanan bir uygulaması yazılmalıdır; bu henüz yapılmadı.

## Yeni dil ekleme

1. `messages/<dil>.json` dosyasını `messages/tr.json` temelinde oluşturun.
2. Dili `src/i18n/routing.ts` içindeki `locales` listesine ekleyin.

Olay içeriği şu an tek dillidir; içerik çevirisi ayrı bir veri modeli çalışması gerektirir.

## Lisanslar ve atıflar

- **Uygulama kodu:** GPL-3.0, bkz. [`LICENSE`](LICENSE).
- **Sınır verisi:** historical-basemaps, GPL-3.0. Lisans ve değişiklik notu `public/data/boundaries/` altındadır.
- **Olay metinleri:** Vikipedi, CC BY-SA. Her olay kendi maddesine bağlantı verir.
- **Olay verisi:** Wikidata, CC0.
- **Görseller:** Wikimedia Commons; lisans her dosyanın kendi sayfasındadır ve panelden bağlantı verilir.
- **Taban harita:** OpenFreeMap, OpenMapTiles, OpenStreetMap katkıcıları.
