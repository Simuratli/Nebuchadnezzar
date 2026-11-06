# Nebuchadnezzar

Available in English (default), Turkish and Azerbaijani.

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

`next dev` ve `next build` aynı `.next` klasörünü kullanır; aynı anda çalıştırmayın. Geliştirme sunucusu açıkken test etmek için derlemeyi ayrı klasöre alın: `NEXT_DIST_DIR=.next-test npm run build`, ardından `NEXT_DIST_DIR=.next-test npm run test:e2e`.

## Veri

### Olaylar: `npm run data:wikidata`

`scripts/fetch-wikidata.ts`, Wikidata SPARQL ve Vikipedi API'sinden `data/seed/events.json`, `sources.json` ve `people.json` dosyalarını üretir.

- Sorgu sonuçları `.cache/wikidata/` altında tutulur. Yarıda kesilirse yeniden çalıştırmak kaldığı yerden sürdürür. Güncel veri için bu klasörü silin.
- Wikidata yoğunken zaman aşımı olağandır. Script yeniden dener; yine de başarısız olan dilimler `ATLANDI` satırıyla günlüğe yazılır ve o dilimin adayları eksik kalır.
- İstekler sıralıdır. Aynı anda birden fazla kopya çalıştırmayın.
- Rotalar (`routes.json`) ve turlar (`tours.json`) elle yazılmıştır, script bunlara dokunmaz. Göç olaylarının çizgileri `data/manual/migrations.json`, kişi listesi `data/manual/people.json` dosyasındadır.

### Güney Kafkasya düzeltmesi: `npm run data:corrections`

historical-basemaps bu bölgeyi 1800–1920 için hatalı gösterir (örneğin 1914'e kadar "Persia"). `scripts/prepare-corrections.ts`, Natural Earth'ün bugünkü idari birimlerini `data/manual/south-caucasus.json` dosyasındaki gruplara göre birleştirir ve dönemleri antlaşmalarla tarihlendirir. Çizgiler tarihî sınır değil yaklaşıktır; tüm kayıtlar `needs_review` taşır. Kuzey Kafkasya bu katmana dahil değildir.

Sıra önemlidir: `data:corrections`, `data:boundaries`, `data:wikidata`, `data:entities`, `data:cards`, `data:polities`.

### Olay kartları: `npm run data:cards`

Taraflar, yer, üst savaş ve imzacılar Wikidata'dan; karşı karşıya gelen taraflar, komutanlar ve sonuç İngilizce Vikipedi bilgi kutularından otomatik okunur. Sonuç metni bu yüzden her dilde İngilizcedir. Antlaşma maddeleri yapılandırılmış hiçbir kaynakta bulunmadığından kartta yoktur.

### Devletler çizelgesi: `npm run data:polities`

Liste `data/manual/polities.json` dosyasındadır. Tarihler Wikidata'dan gelir; orada olmayan veya yanıltıcı olanlar elle girilir ve çizelgede içi boş şeritle gösterilir.

### Kişiler ve şehirler: `npm run data:entities`

`scripts/fetch-entities.ts`, olay ve sınır verisini okuyarak `data/seed/people.json` ile `cities.json` dosyalarını üretir. Bu yüzden diğer iki scriptten sonra çalıştırılır.

- Kişi-olay bağları Wikidata'dan gelir, `data/manual/person-events.json` ile tamamlanır. Elle eklenenler arayüzde "elle bağlandı" olarak görünür.
- Şehirlerin eski adları `data/manual/cities.json` dosyasındadır. Sınır yılı Wikidata ile eşleşmeyen dönemler "doğrulanmadı" olarak görünür.
- Şehirlerin yönetim listesi, şehir konumu sınır dosyalarıyla kesiştirilerek hesaplanır. Bilinen hatalar `data/manual/ruler-overrides.json` ile düzeltilir ve "elle düzeltildi" olarak görünür.

### Sınırlar: `npm run data:boundaries`

`scripts/prepare-boundaries.ts`, [historical-basemaps](https://github.com/aourednik/historical-basemaps) dosyalarını indirir, mapshaper ile sadeleştirir ve `public/data/boundaries/` altına manifest ile birlikte yazar. Seçilen yıl için, o yıldan önceki en yakın dosya gösterilir.

### Veri güvenilirliği

- **`needs_review: true`** kayıtlar arayüzde uyarıyla gösterilir. Türkçe olmayan metinler, özeti olmayan olaylar, elle çizilen göç çizgileri, tüm rotalar ve tur metinleri bu gruptadır.
- **Rotalar ve tur** genel bilgiyle yazılmıştır, kaynak içermez. Akademik kullanımdan önce uzman kontrolü gerekir.
- **Wikidata ve Vikipedi kaynakları** `reliability: 1` (en düşük) taşır. Akademik kaynaklar `data/seed/sources.json` dosyasına elle eklenebilir. Uydurma kaynak eklemeyin; bilinmeyen alanları `null` bırakın.
- **Yıllar** tarihsel sayımla tutulur: negatif değer MÖ'dür ve yıl 0 yoktur.
- **Sınırlar yaklaşıktır.** Veri setinin kendisi de akademik kullanımdan önce başka kaynaklarla karşılaştırılmasını önerir. Kesik çizgi, veri setinde "yaklaşık" işaretli sınırı gösterir.
- **Sınır verisinde bilinen hatalar var.** Örneğin Güney Kafkasya 1815–1900 haritalarında "Persia", İstanbul 1914 haritasında "Bulgaria" içinde görünür. Güney Kafkasya 1800–1920 elle düzeltilmiştir; bunun dışındaki bölge ve dönemlerde harita kaynak veriyi olduğu gibi gösterir.

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

## Arama motorları (SEO)

Harita tarayıcıda çizildiği için içerik ayrıca sunucuda üretilen sayfalarda da bulunur: `/<dil>/events/<id>`, `/<dil>/people/<id>`, `/<dil>/cities/<id>` ve `/<dil>/explore`. Sayfalar ilk istekte üretilip önbelleğe alınır.

- **Yayına almadan önce `NEXT_PUBLIC_SITE_URL` tanımlanmalıdır.** Tanımlı değilse canonical adresler ve sitemap `localhost` gösterir.
- `/sitemap.xml` ve `/robots.txt` otomatik üretilir.
- Bir kaydın o dilde kendi metni yoksa sayfa `noindex` olur ve sitemap'e girmez, böylece aynı metin üç adreste kopya içerik oluşturmaz.
- Paylaşım görseli `public/og.png` dosyasıdır.

## Diller

Varsayılan dil İngilizcedir; Türkçe ve Azerbaycanca başlıktaki seçiciden açılır (`/en`, `/tr`, `/az`).

- **Arayüz:** `messages/<dil>.json`. Üç dosyanın anahtarları ve yer tutucuları testle eşit tutulur.
- **Olay, kişi, şehir metinleri:** Her dilin Vikipedi ve Wikidata kaydından gelir, kayıtların `i18n` alanındadır. Bir dilde metin yoksa İngilizce, o da yoksa başka bir dil gösterilir ve panel bunu belirtir. Metinler makine çevirisi değildir.
- **Elle yazılan içerik (rota, tur, düzeltme notları, eski adlar):** Türkçe yazılır, çevirileri `data/i18n/content.json` dosyasındadır. Yeni bir metin çevirisiz eklenirse test başarısız olur.
- **Harita etiketleri:** Devlet adları sınır verisinden İngilizce gelir, üç dilde de İngilizcedir.

Yeni dil için: `src/lib/types.ts` içindeki `LOCALES` listesine ekleyin, `messages/<dil>.json` oluşturun, `content.json` ve veri scriptlerine o dili ekleyin.

## Lisanslar ve atıflar

- **Uygulama kodu:** GPL-3.0, bkz. [`LICENSE`](LICENSE).
- **Sınır verisi:** historical-basemaps, GPL-3.0. Lisans ve değişiklik notu `public/data/boundaries/` altındadır.
- **Olay metinleri:** Vikipedi, CC BY-SA. Her olay kendi maddesine bağlantı verir.
- **Olay verisi:** Wikidata, CC0.
- **Görseller:** Wikimedia Commons; lisans her dosyanın kendi sayfasındadır ve panelden bağlantı verilir.
- **Taban harita:** OpenFreeMap, OpenMapTiles, OpenStreetMap katkıcıları.
- **Düzeltme katmanı geometrisi:** Natural Earth, kamu malı.
