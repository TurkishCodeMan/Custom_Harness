
---

## 🏗️ Custom-Harness Mimarisi — Mevcut Durum Değerlendirmesi

---

### 1. Temel: Cordis DI Framework

Projenin kalbi [`vendor/cordis`](file:///home/huseyina/code_mode/custom-harness/vendor/cordis/src) — vendored (fork'lanmış) bir bağımlılık enjeksiyonu framework'ü. Temel kuralları:

```
Context → Plugin Registry → Service Fibers
```

| Cordis Kavramı | Ne Anlama Gelir |
|---|---|
| `ctx.plugin(X)` | X'i sisteme yükle, servislerini kaydet |
| `static inject = ['svc']` | "Bu servis olmadan BEN başlamam" — hard dependency |
| `ctx.get('svc', false)` | Servis varsa al, yoksa `undefined` döndür — soft lookup |
| `Service` base class | Her servis `super(ctx, 'name')` ile context'e kaydolur |
| Fiber | Her plugin'in izole yaşam döngüsü; parent ctx ile bağlantılı |

**Kritik kural:** `inject` dizisindeki bir servis henüz yüklenmemişse, Cordis o plugin'i "inactive" bırakır — hata atmak yerine bekler. Bu yüzden döngüsel ya da geç-gelen dependency'ler için `inject` kullanılmaz.

---

### 2. Layered Plugin Stack (Base Bundle)

[`packages/bundle/base/src/index.ts`](file:///home/huseyina/code_mode/custom-harness/packages/bundle/base/src/index.ts) — tüm pluginlerin `apply()` sırasıyla yüklendiği yer:

```
Katman 1 — Capability Seams (Altyapı Soyutlamaları)
  auth, authLocal
  fs, fsLocal
  sandbox, sandboxLocal
  subprocess, subprocessLocal
  spill, spillLocal          ← SpillService seam
  inspector, inspectorLocal
  userApproval, userQuestions
  lsp, rag, web, jobs, terminals, workflow

Katman 2 — Core Services
  settings (önce!)
  tools, skills, systemPrompt
  llm, llmProviderOpenai
  session (satır 113)        ← SessionService burada başlıyor
  agentPresets, persona, repeatGuard
  compactor
  agentMiddleware, agent (satır 123)
  tokenMeter
  reflexion (satır 125)      ← ReflexionService BURADA — session'dan SONRA!
  reflexionLocal (satır 126)

Katman 3 — Built-in Tools
  bash, toolFs, toolTodo, toolAskUser ...
```

**Bu sıralama sorunun temelidir:** `session` (113) `reflexion`'dan (125) önce yükleniyor. Dolayısıyla `SessionService.inject = ['reflexion']` yazarsak, `reflexion` servis hazır olmadan session başlamaya çalışır → Cordis plugin'i askıya alır ya da hata fırlatır.

---

### 3. Seam/Provider/Consumer Deseni

Projede her kapasite için 3 katmanlı yapı var:

```
[Seam / Interface]          [Provider / Impl]         [Consumer]
spill/spill           →     spill/spill-local    →     core-agent (inject: spillStore)
memory/reflexion      →     memory/reflexion-local →   session (optional getter ile)
auth/auth             →     auth/auth-local       →    server-http gateway
inspector/inspector   →     inspector-local       →    gateway events
```

Bu pattern sağlar ki: production'da `spillLocal` yerine farklı bir storage backend kullanabilirsin, servis consumer'ları değişmeden.

---

### 4. Session Service — Yaptığımız Fix'in Yeri

[`packages/session/session/src/index.ts`](file:///home/huseyina/code_mode/custom-harness/packages/session/session/src/index.ts):

```typescript
export const inject = ['settings']  // SADECE settings zorunlu

// ✅ Optional resolution — inject olmadan, Cordis native
private get reflexion(): any {
  return (this.ctx as any).get?.('reflexion', false)
    || (this.ctx as any).reflect?.get?.('reflexion', false)
    || (this.ctx as any).root?.reflexion
}

private get spillStore(): any {
  return (this.ctx as any).get?.('spillStore', false)
    || (this.ctx as any).reflect?.get?.('spillStore', false)
    || (this.ctx as any).root?.spillStore
}
```

Bu getter'lar çağrıldığı anda servisi arar — `clearAllSessions()` veya benzeri metotlar `reflexion`'a eriştiğinde artık "inject olmadan çağrı" hatası almaz, çünkü **o noktada reflexion zaten yüklenmiş olur** (başlatılma sırasının getirdiği avantaj).

---

### 5. Ön Uç (Frontend) Bağlantısı

```
apps/company-os        ← React uygulaması
    └── src/
        ├── ws.js              ← WebSocket client
        ├── hooks/
        │   ├── useApprovals.ts   ← Onay UI state
        │   └── ...
        └── types.js
              
packages/server/server-http
    └── src/
        └── ws/
            └── gateway.ts    ← Backend WS gateway
```

Frontend → `wsClient.send('approval_policy', { policy })` → Gateway → `ctx.approval.setPolicy(policy)` → `ApprovalService`

Gateway aynı zamanda şu event'leri broadcast eder:
- `approval/asked` → UI'da onay kutusu açılır
- `agent/done`, `agent/error` → mesaj sonuçları
- `rag/progress` → RAG indexleme durumu
- `user_question_request` → agent kullanıcıya soru sorar

---

### 6. Paket Sayısı ve Durumu

```
35 packages/  →  ~200+ kaynak dosya
 3 apps/       →  cli, company-os (web), web
 1 vendor/     →  cordis (fork)
```

**Çalışan paketler:**
- ✅ `user-approval` — Onay mekanizması + `submit_decision_for_approval` tool
- ✅ `session` — Oturum yönetimi, reflexion/spillStore optional getter ile
- ✅ `llm + llm-provider-openai` — LLM çağrıları
- ✅ `tool-skill` — Skill sistemi (invoice-review-skill dahil)
- ✅ `reflexion + reflexion-local` — Agent belleği
- ✅ `spill + spill-local` — Büyük çıktıları dosyaya döken mekanizma
- ✅ `agent` — Ana agent loop (`AgentService`)
- ✅ `server-http + WS gateway` — REST + WebSocket

---

### 7. Kalan Açık Konular

| Konu | Durum |
|---|---|
| Invoice Agent loop önleme | Skill + system prompt güncellendi, gözlem gerekli |
| `clearAllSessions` hatası | ✅ Çözüldü — optional getter ile |
| `max_tokens` limiti kontrolü | Henüz doğrulanmadı — model cevabı kesilebiliyor |
| POLICY.md eşik mantığı | 500.000 sabit değer, dinamik yapılabilir |

En kritik gözlem noktası: eğer invoice agent hâlâ loop atıyorsa, `llm-provider-openai`'daki `max_tokens` değerini kontrol etmek gerekiyor — model JSON ortasında kesilirse "tamamlama girişimi" looplarına giriyor.