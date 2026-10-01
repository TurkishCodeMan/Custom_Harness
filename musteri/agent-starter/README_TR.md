# Tek Ajan Fatura İnceleme Başlangıç Paketi

## Ne hazır, ne henüz bağlı değil?

Hazır: tek preset tanımı, sistem prompt'u, açık iş politikası, 30 sentetik vaka,
çıktı JSON şeması, özel cevap anahtarı, deterministik baseline, batch çalıştırıcı,
puanlama scripti, vaka dışa aktarma aracı ve entegrasyon kontrol listesi.

Bağlı değil: sizin Cordis/harness kodunuz, model sunucunuz ve gerçek ERP sistemi.
preset.json taşınabilir bir tanımdır; sizin preset API'nizin birebir config'i olduğu
iddia edilmez. Otomatik model testi için adapter_template.py içindeki tek fonksiyon
gerçek harness'inize bağlanmalıdır. Manuel UI testi bunun tamamlanmasını gerektirmez.

Bu paket analiz MVP'sidir. Ödeme, e-posta, sipariş oluşturma veya üretim verisi değiştirmez.
Python 3.10+ ve standart kütüphane yeterlidir. pip install gerekmez.

## 1. Paketi yerel makinede doğrula

ZIP'i aç, terminalde `agent-starter` klasörüne gir:

```bash
python3 scripts/test_pack.py
python3 scripts/run.py --mode baseline --split all --out results/baseline_local
python3 scripts/evaluate.py --predictions results/baseline_local --split all --report results/baseline_local_report.json
```

Beklenen: 30 vakada %100 exact_case_pct. Bu bir LLM başarısı değildir; iş kuralları,
örnek veriler ve değerlendiricinin tutarlılık kontrolüdür. Dağıtılan doğrulama raporu
results/VERIFICATION.md içindedir. Çalıştırıcı mevcut çıktı dizininin üzerine yazmaz;
tekrar denemede yeni dizin adı kullan.

## 2. Tek preset oluştur

Adı: `invoice-reviewer-v1`.

- SYSTEM_PROMPT.md ve POLICY.md içeriğini güvenilen system/developer talimatına ekle.
- output.schema.json'u çıktı şeması olarak kullan; destek yoksa çıktı sonrasında doğrula.
- Model: önce şu an çalışan modelini kullan, tam model/revizyon adını kaydet.
- Destekleniyorsa temperature=0, seed sabit; yine de tam deterministik sonuç varsayma.
- Başlangıç bütçesi: 12 ajan adımı, 120 saniye, 0 alt ajan. Gerçek token sınırını modeline göre koy.
- Yalnız kapsamı sınırlandırılmış read_file açık; tüm girdi bağlamda ise araç gerekmeyebilir.
- Bash, web, invoke_subagent, yazma, e-posta ve zamanlayıcıyı backend'de kapat.
- Her vaka yeni oturum. RAG, reflexion, önceki konuşmalar ve başka vaka dosyaları kapalı.
- Ayrı tenant: `demo-company`. Gerçek müşteri workspace'inde deneme yapma.

Bu başlangıçta başka preset oluşturma. Sayısal karşılaştırma kuralları kod olarak
üretime taşınabilir; bağımsız baseline bunun referansıdır. Çok ajanı ancak tek ajanın
ölçülmüş eksikliği varsa daha sonra karşılaştır.

## 3. İlk manuel vaka: yalnız doğru dosyaları yükle

Hazır paketler `upload_bundles/D01.zip` ... `T10.zip` içindedir. Her biri yalnız
seçilen vakanın altı dosyasını içerir. İlk deneme için D01.zip'i açman yeterli.
İstersen aynı izinli dosya listesinden yeni bir paket de üretebilirsin:

```bash
python3 scripts/export_case.py --case D01 --out results/upload_D01.zip
```

Bu küçük ZIP'i aç. SYSTEM_PROMPT.md, POLICY.md ve output.schema.json'u preset'e;
input.json'u yalnız o vakanın oturumuna yükle. request.txt içeriğini kullanıcı mesajı
olarak gönder. preset.json yapılandırma rehberidir; backend'e uyarlanmadan güvenlik sağlamaz.

**Ana paketin tamamını ajana YÜKLEME.** evaluator_private, scripts ve results
modelin erişebildiği klasör dışında kalmalı. Cevap anahtarı veya baseline koda erişebilen
ajanın benchmark sonucu geçersizdir. export_case.py yalnız altı izinli dosyayı dışa aktarır.

İlk deneme sırası D01, D06, D07, D09, D10. Sonra D01–D20 tamamını çalıştır.
Her cevabı sadece JSON nesnesi olarak `results/agent_dev/D01.json` vb. kaydet.
Modelin alan adlarını/tutarlarını elle düzeltme. JSON dışı metin veya bozuk JSON
üretirse olduğu gibi bırak; değerlendirmede başarısız sayılmalıdır.

```bash
python3 scripts/evaluate.py --predictions results/agent_dev --split dev --report results/agent_dev_report.json
```

Eksik vakalar paydadan çıkarılmaz. Değerlendirici başarısızlıkta exit code 1 verir;
raporu yine yazar. Summary metninin doğruluğunu otomatik puanlamaz; insan incelemelidir.

## 4. Otomatik harness testi

INTEGRATION_TR.md içindeki sözleşmeyi kullanarak scripts/adapter_template.py dosyasını
ayrı bir adapter dosyasına kopyala ve invoke_existing_harness fonksiyonunu bağla.
stdin bir JSON isteğidir; stdout yalnız nihai çıktı JSON'u, loglar stderr olmalıdır.
Hazır şablon bağlanana kadar kasıtlı olarak hata verir; model çalışmış gibi davranmaz.

```bash
python3 scripts/run.py --mode agent --split dev --out results/agent_dev_run1 --adapter python3 /absolute/path/my_harness_adapter.py
python3 scripts/evaluate.py --predictions results/agent_dev_run1 --split dev --report results/agent_dev_run1_report.json
```

--adapter ve devamı komut satırında en son olmalı. Runner her vaka için ayrı subprocess
açar; harness'in de ayrı session açması gerekir. Runner kendi başına sandbox kurmaz.
Sadece payload'da vaka verisi gönderir; dosya yetkilerini harness sınırlandırmalıdır.

## 5. Geliştirme ve test ayrımı

- D01–D20: prompt/politika uyumu geliştirme seti. Hataları burada incele.
- T01–T10: prompt dondurulduktan sonra ayrı test. Gold'u ajana asla verme.
- Test sonuçlarını görüp ayarlama yaparsan bunlar artık geliştirme verisidir;
  yeniden güvenilir ölçüm için yeni, görülmemiş gerçek vakalar ayır.
- Test vakaları aynı politika ailelerinden yeni örneklerdir; dağılım dışı test,
  bağımsız müşteri doğrulaması veya istatistiksel üretim garantisi değildir.
- Her ayrımı 3 bağımsız oturum turuyla çalıştır; maliyet, süre ve sonuç oynaklığını kaydet.

```bash
python3 scripts/run.py --mode agent --split test --out results/agent_test_run1 --adapter python3 /absolute/path/my_harness_adapter.py
python3 scripts/evaluate.py --predictions results/agent_test_run1 --split test --report results/agent_test_run1_report.json
```

## 6. Başlangıç geçiş hedefleri

Bu küçük ve basit sentetik sette %100 geçerli JSON, 0 false CLEAR ve tüm tutarların
doğru hesaplanmasını hedefle. Her hata anlaşılmadan sonraki aşamaya geçme.
30 örneğin tamamında başarı, gerçek veride %100 başarı anlamına gelmez.
Tek bir modele ait ortalama skor yerine üç tekrarın en kötü sonucunu da raporla.

Ana metrikler: exact_case_pct, valid_output_pct, decision_accuracy_pct,
finding_f1_pct, amount_accuracy_pct, evidence_exact_pct, false_clear_count.
F1'ı tek başına kullanma: şema hataları, yanlış tutarlar ve yanlış kanıtlar ancak
diğer metriklerle görünür. Beklenen kod + line_id aynıysa finding eşleşir; tutar
ve kanıt ayrıca ve exact_case içinde denetlenir. Summary, niyet, güvenlik veya gerçek
araç davranışı bu skorların kapsamında değildir.

## 7. Sonraki ürün adımı

1. Sentetik seti geç; hataları türlerine ayır.
2. İzinli gerçek vaka topla; belgeleri uzman etiketlesin.
3. OCR/PDF extraction'ı ayrı bir aşama olarak ekle ve alan doğruluğunu ayrıca ölç.
4. Belirsiz sözleşme/prosedür yorumu gereken vakalarda ajan + kurallar ile yalnız
   kuralları karşılaştır. Bu paketteki yapılandırılmış vakaların tamamı kurallarla
   çözülebilir; burada ajan gerekliliği veya ticari değer ispatlanmış değildir.
5. Önce gölge mod; sonra onaylı tek bir görev oluşturma entegrasyonu.
6. RUNTIME_TESTS.md maddelerini gerçek backend üzerinde uygula. Bu testler bu pakette
   çalıştırılmış veya geçmiş olarak işaretlenmemiştir.

## Dosya düzeni

| Yol | Kimin için? |
|---|---|
| runtime/preset/ | Preset yöneticisi ve ajan |
| runtime/cases/dev/Dxx/ | Seçilen tek geliştirme vakasının ajanı |
| runtime/cases/test/Txx/ | Dondurulmuş preset için seçilen tek test vakasının ajanı |
| evaluator_private/ | Yalnız geliştirici/değerlendirici |
| scripts/ | Yerel çalıştırıcı ve değerlendirici; ajana kapalı |
| results/ | Yerel çıktı ve raporlar; ajana kapalı |
| upload_bundles/ | Her vaka için ayrı, cevap anahtarı içermeyen altı dosyalık ZIP |
