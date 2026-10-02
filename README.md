# 🏗️ Custom-Harness Mimarisi ve Sistem Kılavuzu

Custom-Harness; Cordis mikro-çekirdek tabanlı, çoklu kiracılı (multi-tenant), kontrat güvenli (contract-safe) ve yerel LLM odaklı kurumsal bir yapay zeka ajan çalışma zamanıdır (Agent Runtime).

---

## 📁 1. Konfigürasyon ve Veri Dizinleri (`~/.dsh`)

Sistem tüm çalışma zamanı durumunu, kullanıcı tercihlerini, oturumları ve model sağlayıcılarını `~/.dsh` altında hiyerarşik ve kiracı bazlı (tenant-isolated) olarak saklar:

```
~/.dsh/
├── settings.yaml                    # 🌐 Global Sistem & Model Konfigürasyonu
├── agent-presets/                   # 👥 Global Ajan Rol Şablonları (Presets)
│   └── full-stack.json
├── spills/                          # 🌊 Büyük Tool Çıktıları Deposu (Spillover)
├── inspector/                       # 🔍 Ajan Adım, Turn & Karar Kayıtları
└── tenants/                         # 🏢 Kiracı / Kullanıcı İzolasyon Alanı
    └── user_admin/
        ├── settings.json            # ⚙️ Kullanıcı Tercihleri (Aktif Model, Workspace, UI)
        ├── presets/                 # 🎭 Kullanıcıya Özel Pozisyon & Koltuk Presetleri
        │   ├── invoice-reviewer-v1.json
        │   ├── senior-cfo-v1.json
        │   ├── procurement-manager-v1.json
        │   └── executive-assistant-v1.json
        ├── sessions/                # 💬 Sohbet & Oturum Geçmişleri (JSON)
        └── uploads/                 # 📎 Kullanıcı Yüklemeleri & Ek Dosyalar
```

### Kritik Ayar Dosyaları ve Görevleri

| Dosya Yolu | Format | Görev ve İçerik |
|---|---|---|
| `~/.dsh/settings.yaml` | YAML | Sistem aktif sağlayıcısı (`defaultProvider`), varsayılan model (`defaultModel`), LLM sağlayıcı uç noktaları (`qwen-local` 8004, `qwen-bsc` 8989), aktif eklentiler ve sandbox modu. |
| `~/.dsh/tenants/<user>/settings.json` | JSON | Kullanıcının seçtiği aktif çalışma alanı (`workspace`), varsayılan rol/koltuk (`defaultPreset`) ve UI teması. |
| `~/.dsh/tenants/<user>/presets/<id>.json` | JSON | Ajan koltuk tanımları: sistem istemi, `enabledTools`, `enabledSkills`, `fileScope` (read/write/deny), A2A kontratları (`inputSchema`/`outputSchema`), `allowedDelegates` ve `allowedCallers`. |

---

## 🧩 2. Temel: Cordis DI Framework

Projenin çekirdeği [`vendor/cordis`](vendor/cordis/src) bağımlılık enjeksiyonu (Dependency Injection) çatısıdır:

```
Context (ctx) → Plugin Registry → Service Fibers
```

| Cordis Kavramı | Açıklama |
|---|---|
| `ctx.plugin(X)` | X eklentisini sisteme kaydeder ve yaşam döngüsünü başlatır. |
| `static inject = ['svc']` | **Hard Dependency:** Bu servis hazır olmadan eklenti ayağa kalkmaz. |
| `ctx.get('svc', false)` | **Soft Lookup:** Servis yüklüyse referansı alır, yoksa `undefined` döner. |
| `Service` base class | Her servis `super(ctx, 'name')` çağrısıyla Cordis Context'ine bağlanır. |
| Fiber | Her eklentinin izole yaşam döngüsünü yöneten yapı. |

> [!IMPORTANT]
> `inject` dizisindeki bir servis henüz yüklenmemişse Cordis hata fırlatmak yerine eklentiyi askıya alır (inactive). Bu sebeple döngüsel veya geç yüklenen bağımlılıklar için getter tabanlı soft lookup (`this.ctx.get?.(...)`) kullanılır.

---

## 🥞 3. Katmanlı Eklenti Mimarisi (Base Bundle)

[`packages/bundle/base/src/index.ts`](packages/bundle/base/src/index.ts) üzerinden yüklenen 3 ana katman:

```
Katman 1 — Capability Seams (Altyapı Soyutlamaları)
  auth, authLocal, fs, fsLocal, sandbox, sandboxLocal, subprocess, subprocessLocal,
  spill, spillLocal, inspector, inspectorLocal, userApproval, userQuestions,
  lsp, rag, web, jobs, terminals, workflow

Katman 2 — Core Services
  settings                ← İlk olarak ayarlar ve sağlayıcılar yüklenir
  tools, skills, systemPrompt
  llm, llmProviderOpenai  ← Model çıkarım katmanı (vLLM / llama.cpp / OpenAI)
  session                 ← Oturum yönetimi
  agentPresets, persona, repeatGuard, compactor
  agentMiddleware, agent  ← Ana muhakeme döngüsü (Agent Reasoning Engine)
  tokenMeter
  reflexion, reflexionLocal ← Epizodik hafıza ve özeleştiri

Katman 3 — Built-in Tools
  toolFs (read_file, write_file, edit_file)
  toolSkill (.agents/skills loader)
  toolTodo, toolAskUser, toolSubagent ...
```

---

## 🔄 4. Seam / Provider / Consumer Deseni

Tüm yetenekler 3'lü soyutlama deseniyle kurgulanmıştır:

```
[Seam / Interface]          [Provider / Impl]             [Consumer]
spill/spill           →     spill/spill-local       →     core-agent (inject: spillStore)
memory/reflexion      →     memory/reflexion-local    →   session (optional getter ile)
auth/auth             →     auth/auth-local          →    server-http gateway
inspector/inspector   →     inspector-local          →    gateway events
llm/llm               →     llm-provider-openai      →    core-agent
```

Bu yapı sayesinde production ortamında örneğin `spill-local` yerine S3 veya Redis, `llm-provider-openai` yerine doğrudan vLLM gRPC sağlayıcısı takılabilir; üst katmanlar bundan etkilenmez.

---

## 🛡️ 5. Güvenlik, Dosya Sınırları (File Scope) ve A2A Kontratları

Her ajan profili katı sınırlarla sınırlandırılmıştır:

1. **File Scope ACL:**
   - `read`: İzin verilen okuma kalıpları (örn. `finance/invoices/**`, `cases/**`).
   - `write`: Yalnızca izin verilen vaka çıktı klasörleri (örn. `cases/*/agent_outputs/**`).
   - `deny`: Asla erişilemeyen gizli veya kök dosyalar (`.env*`, `**/.*`).
2. **Contract-Safe Delegasyon (A2A):**
   - Ajanlar arası çağrılarda (`invoke_subagent` veya özel `delegate_to_*` araçları) `inputSchema` ve `outputSchema` JSON şemalarıyla doğrulanır.
   - Çağırma zincirinde `allowedCallers` ve `allowedDelegates` kontrol edilir; yetkisiz ajanlar birbirine emir veremez.

---

## ⚡ 6. Runtime İyileştirmeleri ve Çözülen Sorunlar

Son yapılan optimizasyonlarla tespit edilen loop ve verimlilik sorunları giderilmiştir:

### A. Invoice Reviewer 23-Turn Döngü Problemi (Çözüldü ✅)
- **Sorun:** Model 10. adımda `write_file` çağırırken JSON sonuna `_arithmetic_recalculation_omitted_for_compactness` satırı ekleyip sözdizimini kapatmıyordu. Dosyayı kontrol ettiğinde "omitted" kelimesini görüp dosyanın truncate edildiğini zannediyor ve `bash` üzerinden `cat`, `python3`, `base64`, `printf >>` denemelerine girerek 23 turn harcıyordu.
- **Kök Neden 1 (`frequency_penalty`):** `llm-provider-openai` içinde hardcode edilmiş `0.3` ve `0.2` cezaları, tekrarlayan JSON anahtarlarını cezalandırarak modelin anahtar uydurup yarım bırakmasına yol açıyordu. **Cezalar sıfırlandı (`0`).**
- **Kök Neden 2 (`write_file` geri bildirimi):** `write_file` artık dosyanın diske kaç karakter ve satır yazıldığını doğrulamakta (`Successfully wrote X characters (Y lines)...`) ve hedef `.json` ise JSON geçerliliğini anında denetlemektedir.
- **Kök Neden 3 (Mükerrer `write` aracı):** `tool-fs` içindeki mükerrer `write` kaldırıldı, standart `write_file` bırakıldı.
- **Kök Neden 4 (Gereksiz `bash` yetkisi):** Fatura denetçisinden `bash` kaldırıldı; action space daraltıldı ve terminal fallback döngüleri engellendi.

### B. Çoklu Model ve Yerel vLLM (8004) Çakışması (Çözüldü ✅)
- **Sorun:** Hem BSC (`http://localhost:8989/v1`) hem de yerel vLLM (`http://localhost:8004/v1`) üzerindeki modeller `Qwen3.8-27B` model ID'sine sahip olduğu için, arayüz dropdown'ı yerel seçildiğinde ilk eşleşen BSC'ye geri sıçrıyordu.
- **Çözüm:** `SettingsPage.tsx` seçici anahtarı benzersiz `${providerId}:::${modelId}` yapıldı. Eski 8888 Gemma hayalet kayıtları `settings.yaml` üzerinden temizlendi ve aktif model yerel **`qwen-local` (8004)** olarak sabitlendi.

---

## 🚀 7. Çalıştırma ve Geliştirme

```bash
# Bağımlılıkları yükle
pnpm install

# Backend HTTP & WebSocket Sunucusunu Başlat (Port 3080)
pnpm dev

# Atlantic AI / Company OS Arayüzünü Başlat (Port 3090)
pnpm company-os

# Arayüzü Derle (Production Build)
pnpm --filter @custom-harness/company-os build

# Testleri Çalıştır
pnpm test
```