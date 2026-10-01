# Mevcut Cordis harness'ine bağlama

Repo API'si görülmedi. Bu belge bir arayüz sözleşmesidir; mevcut export/route isimleri
uydurulmamıştır. Gerçek preset kayıt şekline ve agent.run imzasına senin kodunda uyarlanır.

## En kısa yol: UI ile tek preset

1. Preset kayıt mekanizmanda invoice-reviewer-v1 oluştur.
2. SYSTEM_PROMPT.md + POLICY.md yükle; output.schema.json uygula.
3. Backend tool allowlist'ini yalnız vaka kapsamındaki read_file olarak ayarla.
4. Yeni oturuma input.json ve request.txt ver.
5. Nihai JSON'u alıp vaka kimliğiyle yerel sonuç dizinine yaz.

Tek preset tek mantıksal ajandır. Ajanın birden fazla araç adımı atabilmesi çok ajan
olduğu anlamına gelmez. invoke_subagent kapalıdır.

## Batch adapter sözleşmesi

Runner stdin'e şunu gönderir:

```json
{
  "preset_id": "invoice-reviewer-v1",
  "fresh_session": true,
  "system_prompt": "...güvenilen system prompt ve politika...",
  "input": {"case_id": "D01", "...": "..."},
  "output_schema": {"...": "JSON Schema"},
  "request": "...kullanıcı görevi..."
}
```

Adapter gerçek harness'te yeni session açar, doğru rollerde talimat/veri gönderir,
stream varsa son cevabı toplar, JSON'u döndürür ve session'ı kapatır.
Modelin final içeriği bozuksa adapter düzeltmeye veya gold'a göre cevap üretmeye çalışmaz.
Veri formatını düzeltmek istenirse bu ayrı bir deney koşulu olarak kaydedilir.

stdout çıktısı yalnız schema ile uyumlu analiz nesnesidir. Araç/event logları stderr'e
veya ayrı güvenli trace deposuna gider. API anahtarlarını loglama.
run.py adapter hata çıktısını otomatik rapora taşımadığı için adapter'ın ayrıntılı
loglarını kendi dosyasında tutması önerilir. Timeout, session iptalini de tetiklemelidir;
subprocess'in bitmesi uzaktaki işi kendiliğinden durdurmayabilir.

## Yetki uygulaması

- Preset allowlist'ini server tarafında uygula. Prompt'taki yasaklar yetki sınırı değildir.
- Tenant kimliğini authenticated session'dan al. input.json.tenant_id yalnız fixture
  metadatasıdır; gerçek işlemde kullanıcı verisinden yetki türetme.
- Vakaya özel salt okunur mount. Başka vakalar, cevap anahtarı, spills, geçmiş session
  ve global workspace görünür olmamalı. Symlink/path traversal denetimi server'dadır.
- İlk benchmark'ta RAG ve reflexion kapalı. RAG sonradan açılırsa belge ACL/tenant
  filtresini retrieval öncesinde uygula ve kaynak belge sürümünü kaydet.
- Sonucun kaydını harness yapar. Ajanın genel write_file yetkisine ihtiyacı yoktur.
- Model veya adapter hata verirse başarısız vaka olarak kaydet; otomatik CLEAR atama.

## Kaydedilecek deney metadatası

Model adı ve revision, sağlayıcı, temperature/seed (destekleniyorsa), prompt/politika
hash'i, harness commit'i, tool allowlist, vaka seti sürümü, tarih, token kullanımı,
çağrı maliyeti, toplam süre, session/trace ID. run_log.jsonl yalnız süre, durum ve
çalışma modunu sağlar; token ve maliyet için gerçek harness telemetrisi gerekir.

## Analiz MVP'sinden eylem MVP'sine

İlk gerçek yazma aracı yalnız create_review_task olsun. Önerilen sözleşme:
case_id, expected_case_version, action_payload, approval_id, idempotency_key.
Tenant ve kullanıcı scope'u backend session'ından gelir.

Approval kaydı onaylayan kişi, action_payload hash'i, vaka sürümü ve son kullanma
zamanına bağlanır. İşlem öncesi hepsi doğrulanır. Aynı idempotency_key ile değişik
payload reddedilir. Aynı payload tekrarı mevcut task sonucunu döndürür.
Timeout sonrası önce dış sistemde task varlığı araştırılır; belirsiz durumda kör
retry yapılmaz. Sonuç authoritative API ile okunup doğrulanır.

Bu eylem katmanı paket içinde uygulanmış değildir; analiz ölçümü sonrasının backlog'udur.

