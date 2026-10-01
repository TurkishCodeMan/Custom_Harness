# Agent — Nasıl Çalışır?

Bu klasör, Custom Harness'ın kalbidir. Bir kullanıcı mesajı aldıktan sonra model yanıt verene (ya da max tur dolana) kadar tüm döngüyü yönetir.

---

## Genel Akış

```
Kullanıcı mesajı
      │
      ▼
[run()] ─── session.messages'a yaz
      │
      ▼
┌─────────────────────── while (turn < 60) ─────────────────────────┐
│                                                                    │
│  1. buildLlmPayload()          ← temiz, lean payload hazırla      │
│  2. prepareToolsForPreset()    ← preset'e göre tool listesi       │
│  3. agentMiddleware.beforeChat ← middleware hooks                  │
│  4. llm.streamChat()           ← model'e gönder, stream al        │
│  5. extractThoughts()          ← <think> bloklarını ayıkla        │
│                                                                    │
│  ┌── pendingToolCalls > 0? ──┐                                     │
│  │ EVET → tool'ları sıralı  │  HAYIR → afterChat middleware       │
│  │         çalıştır         │          → autonomous devam?        │
│  │         devam et         │          → hayır → break (bitti)    │
│  └───────────────────────────┘                                     │
└────────────────────────────────────────────────────────────────────┘
      │
      ▼
finalResponse döndür
```

---

## LLM Payload Pipeline — `buildLlmPayload()`

Her tur başında `session.messages` **kopyalanır**, üzerinde 4 adımlı temizleme yapılır ve LLM'e gönderilir. **Orijinal session hiçbir zaman mutate edilmez.**

```
session.messages (kopyala)
      │
      ▼
[1] compactor.compact()          ← varsa eski özetlere dönüştür
      │
      ▼
[2] ensureUserMessage()          ← en az 1 user mesajı garantisi
      │
      ▼
[3] stripReasoningFromHistory()  ← reasoning_content'i sil (↓)
      │
      ▼
[4] applyToolOutputSlidingWindow() ← eski tool çıktılarını kes (↓)
      │
      ▼
[systemPrompt, ...temizMessages] → llm.streamChat()
```

### [3] `stripReasoningFromHistory` — Reasoning Temizliği

Model `<think>...</think>` bloklarını (veya `reasoning_content` alanını) her turda üretir. Bu bloklar:
- **Kullanıcıya gösterilir** (UI'da)
- **Session'a yazılır** (audit için)
- **LLM'e geri beslenmez** ← bağlamı ikiye katlar, faydası sıfır

Her assistant mesajından `reasoning_content` alanı çıkarılır. Model sadece kendi **net kararını** (`content`) ve yaptığı `tool_calls`'ı görür.

### [4] `applyToolOutputSlidingWindow` — Kayan Pencere

Tool çıktıları bağlamın en büyük şişiricisidir. Çözüm:

```
Eski turlar (window dışı):        Yeni turlar (son 2 tur, window içi):
─────────────────────────         ────────────────────────────────────
Büyük tool çıktısı                Tool çıktısı mevcut ama 3000 char'da kesilir
→ 1 satır referansa dönüşür       → Aşanlar: baş + kuyruk + "kısaltıldı" notu
"[Önceki turda X çalıştırıldı…]"
```

| Parametre | Değer |
|:---|:---|
| `windowSize` | 2 tur (son 2 assistant mesajı korunur) |
| `maxToolChars` | 3.000 karakter (pencere içi tool çıktı üst sınırı) |
| Kısa çıktılar (≤200 char) | Asla sıkıştırılmaz |

---

## Spill Mekanizması — `spill-local`

Spill, **tool çalıştırıldığı anda** devreye girer; sliding window'dan bağımsız ve daha önce gerçekleşir.

### Eşik: 3.000 token (~10.800 karakter)

```
Tool çıktısı geldi
      │
      ├── ≤ 3000 token → doğrudan LLM'e gönder (tam metin)
      │
      └── > 3000 token → SPILL
            │
            ├── Tam metin → ~/.dsh/spills/session-<hash>/<timestamp>_<tool>.txt
            │
            └── LLM'e gönder:
                  ─ Baş 2000 char (önizleme)
                  ─ "X karakter gizlendi" notu
                  ─ Kuyruk 1000 char
                  ─ "read_file ile dosyaya bakabilirsin" ipucu
                  ─ Tam dosya yolu (model doğrudan okuyabilir)
```

### Spill Güvenliği
- Her session kendi izole dizinini alır (`sha256` hash ile isimlendirme)
- Dosyalar `chmod 600` (sadece owner)
- Başka session'ların spill dizinine `tool-bash` ve `tool-fs` erişemez (path guard)

---

## Tool Result Pruner — `compaction-tool-result-pruner`

Spill'den geçmemiş ama yine de büyük çıktılar için ikinci güvenlik ağı. **Provider katmanında** (`llm-provider-openai`) çalışır:

| Eşik | Davranış |
|:---|:---|
| ≤ 12.000 char | Dokunmaz |
| > 12.000 char | Baş 2000 + Kuyruk 1000 + "budandı" notu |

Spill → Pruner → Sliding Window sıralaması kasıtlıdır: her katman diğerinin kaçırdığını yakalar.

---

## Tool Çalıştırma — Sıralı, Paralel Değil

Model bir turda birden fazla tool çağrısı yapabilir. Bunlar **sıralı** çalıştırılır (`for...of`, `Promise.all` değil).

**Neden?** Paralel çalıştırma `session.appendMessage` sıralamasını bozar ve `read_file → write_file` gibi bağımlı çağrılarda filesystem race condition yaratır.

---

## Ephemeral Queue

Bazı mesajlar session'a **yazılmadan** yalnızca bir sonraki LLM turuna enjekte edilir:
- `afterChat` middleware'in `shouldContinue + prompt` döndürmesi
- `autonomous` mod devam talebi

Bu mesajlar `ephemeralQueue`'ya konur, o tur tüketilir, sonra silinir. Kalıcı geçmişe asla eklenmez.

---

## Özet: Token Bütçesi Koruması Katmanları

```
1. SpillStore          → ≥3000 token → dosyaya yaz, önizleme ver
2. ToolResultPruner    → ≥12000 char → baş/kuyruk kes
3. SlidingWindow       → 2 turdan eski tool çıktısı → 1 satır ref
4. ReasoningStrip      → reasoning_content → payload'dan sil
5. Compactor           → çok uzun session → özetlere dönüştür
```

Her katman bağımsız çalışır ve orijinal `session.messages`'a asla dokunmaz. Modelin aldığı paket her zaman lean, sıralı ve deterministic'tir.

---

## Dosya Haritası

| Dosya | Sorumluluk |
|:---|:---|
| `src/index.ts` | Ana loop, `run()`, `buildLlmPayload()` |
| `src/message-pruner.ts` | `stripReasoningFromHistory`, `applyToolOutputSlidingWindow`, `ensureUserMessage` |
| `src/tool-scoper.ts` | Preset'e göre tool/skill filtreleme |
| `src/tool-executor.ts` | Tek bir tool çağrısını çalıştırma |
| `src/resolver.ts` | Provider, model, preset çözümlemesi |
| `src/prompt-builder.ts` | System prompt oluşturma |
| `src/thoughts.ts` | `<think>` bloğu ayıklama |
| `src/types.ts` | `AgentRunOptions`, `ToolExecutionContext` |
