# Paket doğrulama — 29 Eylül 2026

- 20 geliştirme + 10 test vakası: toplam 30 sentetik vaka.
- Bağımsız yazılmış beklenen sonuçlar ile deterministik baseline: 30/30 tam eşleşme.
- test_pack.py: 12 test başarılı.
- Hata yakalama kontrolleri: eksik cevap, yanlış tutar, uydurma kanıt, yinelenen bulgu,
  bozuk çıktı alanı, negatif/sonsuz miktar, yinelenen JSON anahtarı, yanlış case_id.
- Sınır kontrolleri: null/boş teslimat ayrımı ve 0.01 para toleransı.
- Batch adapter protokolü: deterministik simülasyon adapter'ıyla doğrulandı.
- Bağlanmamış adapter şablonunun açık hata verdiği doğrulandı.

Gerçek model çalıştırılmadı. Kullanıcının Cordis reposu, tenant izolasyonu, sandbox,
üretim entegrasyonu ve eylem katmanı test edilmedi. Bu rapor yalnız teslim edilen
paketin yerel doğrulamasıdır. RUNTIME_TESTS.md maddeleri hâlâ bekliyor.

baseline_verified_report.json sonuçları LLM başarısı olarak sunulmamalıdır.
Benchmark tasarımını bilen aynı geliştirici hem fixture hem baseline yazdığı için
gerçek bağımsız doğrulamada alan uzmanı etiketleri ve yeni vakalar kullanılmalıdır.

