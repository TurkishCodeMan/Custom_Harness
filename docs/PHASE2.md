# Custom Harness — Faz 2: Controlled Agent Workflow Runtime Mimarisi ve Yol Haritası

## 📌 1. Yönetici Özeti ve Mevcut Durum Analizi

### 1.1. Neyi Başardık? (Seviye 2: İzole Rol Ajanı)
Mevcut Custom Harness mimarisi, klasik "sistem promptu değiştirilmiş chatbot" kalıbını tamamen aşmış ve kurumsal güvenliği merkeze alan **Seviye 2: İzole Edilmiş Uzman Ajan** seviyesine ulaşmıştır.

* **Sıfır Güven Eylem Uzayı (Zero-Trust Tool Whitelisting):** `tool-scoper.ts` katmanı ile her ajanın eylem uzayı fiziksel olarak kısıtlanmıştır. Fatura Ajanı diske dosya yazamaz veya yetkisiz alt ajan çağıramaz; yalnızca denetim için yetkilendirildiği araçları (`bash`, `read_file`, `list_dir`, `grep_search`, `skill`) görebilir.
* **Çalışma Alanı İzolasyonu (Workspace Confinement):** Her ajan yalnızca kendi yetkili tenant/dizin sınırları içinde (`COMPANY_ABC/invoices`) işlem yapabilir.
* **Bilişsel Donanım Özelleştirmesi:** Preset bazlı `modelId`, `providerId`, deterministik `temperature: 0.0` ve katı `responseFormat` (JSON Schema) Company OS UI üzerinden doğrudan yönetilebilir hale getirilmiştir.
* **İzole Deneyim Hafızası (Preset-scoped Reflexion):** Ajanın yaptığı hatalardan çıkardığı dersler (`lessons`) diğer ajanların zihnine karışmaz.
* **Akıllı Bağlam Sıkıştırma (Compaction Basic Service):** 30 mesaj veya 12.000 token sınırında kritik bağlamı çapalayarak (`Compacted Context Anchor`) maliyeti düşürür ve bellek taşmasını önler.

### 1.2. Faz 2 Yeniden Konumlandırma: "Dinamik Genişletilebilirlik" ve "Kontrollü İş Akışı" Sentezi
Faz 2'nin hedefi; kontrolsüz bir "Ajan Sürüsü" (Swarm) oluşturmak **olmadığı gibi**, her yeni koltuk için backend'de TypeScript kodu yazmayı gerektiren **katı ve hantal bir yapı da değildir**.
Sistemimiz:
1. **Dinamik ve No-Code Genişletilebilir:** Müşteri Company OS arayüzünden tek satır kod yazmadan yeni bir koltuk (örn: *Lojistik Ajanı*, *Hukuk Danışmanı*) ekleyebilir, beklediği girdileri JSON Schema standardında tanımlayabilir.
2. **Tip Güvenlikli Delege (Declarative JSON Schema Delegation):** Yetkili ajanlar, hedef ajanın tanımlı JSON şemasına göre dinamik üretilen `delegate_to_<presetId>` araçları üzerinden yapılandırılmış veri alışverişi yapar.
3. **Deklaratif Doğrulama Motoru (Declarative Verifier):** Kararlar, presete tanımlanan matematiksel ve politik kurallarla (Aritmetik kontrol, PO zorunluluğu) kod tabanlı denetlenir; kural ihlalinde karar anında düzeltilir.

---

## 🏗️ 2. Temel Mimari Akış

```mermaid
graph TD
    Trigger[Olay / Webhook / Kullanıcı] --> Pipeline[Aşamalı PDF Boru Hattı\nextract -> match -> ground -> decide]
    Pipeline --> InvoiceAgent[Invoice Reviewer Agent]
    
    subgraph DynamicDelegation [Dinamik Şema Tabanlı Delege]
        InvoiceAgent -->|Dinamik Araç: delegate_to_erp_validator| ERPValidator[ERP / DB Validator Agent]
        ERPValidator -->|Yapılandırılmış Çıktı| InvoiceAgent
    end

    InvoiceAgent --> DecVerifier[Deklaratif Doğrulama Motoru\n(Aritmetik + PO/GRN Politika Kontrolü)]
    
    DecVerifier -->|Uyuşmazlık Varsa| FailSafe[Otomatik Karar Düzeltme: NEEDS_INFO / REVIEW]
    DecVerifier -->|Semantik Şüphe Varsa| Critic[Opsiyonel LLM Critic]
    DecVerifier -->|Doğrulandı| FinalReport[Kesin Denetim Raporu]
```

---

## 📅 3. Kontrollü Uygulama Zinciri (Sprint Planı)

| Adım | Odak Alanı | Teslim Edilecek Modüller |
| :--- | :--- | :--- |
| **Adım 1** | **Gerçek PDF Pipeline & Observability** | Sayfa/tablo çıkarma, aşamalı loglama (`extract -> match -> ground -> decide`), doğruluk testleri. |
| **Adım 2** | **Dinamik JSON Schema Delege Altyapısı** | `AgentPreset.inputSchema`, `allowedDelegates` desteği; `tool-scoper.ts`'te hedef ajanın şemasına göre dinamik `delegate_to_<presetId>` aracı üretimi. |
| **Adım 3** | **Deklaratif Doğrulama Motoru (Declarative Verifier)** | Kod içine gömülü olmayan, presette JSON olarak tutulan denetim kurallarının (Aritmetik, PO/GRN, Tutar limiti) çalıştırılması. |
| **Adım 4** | **Dayanıklı İş Akışı (Durable Workflow)** | `case_id`, `idempotency_key`, `attempt_count` ile mükerrer çalışmayı engelleyen güvenilir dosya/webhook tetikleyicisi. |
| **Adım 5** | **Yapılandırılmış Kayıt Sistemi (System of Record)** | SQLite tabanlı fiyat ve tedarikçi kayıt motoru, `query_item_price_benchmark` aracı. |

---

## 🎯 4. Kurumsal Başarı Kriterleri (KPIs)

1. **False Clear Rate = %0:** Hatalı, PO'su eksik veya KDV hesabı tutarsız faturaya yanlışlıkla onay (`CLEAR`) verilme oranı sıfır olmalıdır.
2. **Selective Accuracy:** Ajan emin olmadığı en ufak durumda kural gereği kararı `NEEDS_INFO` veya `REVIEW` olarak işaretleyip insana eskalasyon yapabilmelidir.
3. **No-Code Extensibility:** Müşteri tek satır TypeScript derlemesi yapmadan UI'dan yeni bir uzman koltuk ekleyip diğer ajanlarla konuşturabilmelidir.
4. **Sıfır Token Sızıntısı:** Delege çağrılarında parent mesaj geçmişi taşınmayacak, alt ajana sadece dinamik JSON Schema parametreleri iletilecektir.
