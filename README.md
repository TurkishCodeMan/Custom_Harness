# 🚀 Custom Harness

Cordis framework'ü üzerine inşa edilmiş, hafifletilmiş, modüler ve genişletilebilir AI Ajan Geliştirme Platformu.

Bu proje; gereksiz monorepo kalıntılarından arındırılmış, **tam özellikli modern bir Web UI (Model yönetimi, model keşfi, canlı sohbet, araç kartları)** ve **saf Bash komut aracı (`tool-bash`)** ile çalışan temiz bir başlangıç şablonudur.

---

## 📁 Proje Klasör Mimarisi

```text
custom-harness/
├── vendor/                   # 1. Cordis Framework Çekirdeği (Context, Service, Loader)
│   ├── cordis/
│   ├── loader/
│   └── cosmokit/ & schemastery/
│
├── packages/                 # 2. Modüler Yetenek Paketleri
│   ├── core/                 # Ajan döngüsü, araç kayıt defteri, oturum yönetimi
│   ├── llm/                  # Çoklu model desteği (OpenAI, vLLM, Gemma, DeepSeek, Anthropic)
│   ├── shell/                # Bash komut aracı (tool-bash) ve sandbox
│   ├── client/               # React Web UI bileşenleri (Sohbet, model ayarları, araç kartları)
│   ├── skill/                # Beceri (SKILL.md) keşif ve yükleme motoru
│   └── bundle/               # Base ve Web-App eklenti profilleri
│
├── apps/                     # 3. Uygulama Başlatıcıları
│   ├── cli/                  # `dsh` komut satırı ve Web server başlatıcısı
│   └── web/                  # Vite + React Web UI ön yüzü
│
└── .agents/                  # 4. Ajan Becerileri ve Kararlar
    └── skills/               # Özel beceriler (.agents/skills/<ad>/SKILL.md)
```

---

## ⚡ Hızlı Başlangıç

### 1. Bağımlılıkları Yükleme ve Derleme
```bash
# Bağımlılıkları yükle
pnpm install

# Tüm projeyi ve Web UI'ı derle
pnpm run build
```

### 2. Web Arayüzünü Başlatma
```bash
# Web sunucusunu başlat (Varsayılan port: 3080)
pnpm dsh web
```
Tarayıcınızdan `http://127.0.0.1:3080` adresini açarak sohbete başlayabilirsiniz.

---

## 🌐 Web UI Üzerinden Model Yönetimi

Web arayüzünde sol alttaki **Settings ➔ Models** menüsüne giderek:
1. **Model Ekleme:** Yerel modelinizi (`http://localhost:8888/v1`), Ollama'yı veya DeepSeek API'yi ekleyebilirsiniz.
2. **Fetch Models (Otomatik Keşif):** Endpoint URL'sini yazıp "Fetch models" butonuna basarak sunucudaki tüm modelleri otomatik listeleyebilirsiniz.
3. **Parametre Ayarları:** Her model için ayrı ayrı `contextWindow` (bağlam boyutu) ve `maxTokens` (çıktı limiti) belirleyebilirsiniz.

---

## 🧩 Kendi Özel Aracınızı (Custom Tool) Nasıl Eklersiniz?

Sisteme yeni bir Cordis aracı eklemek için iki basit adım yeterlidir:

### 1. `packages/` altında yeni paket oluşturun veya mevcut aracı yazın:
```ts
import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Schema } from '@deepseek-ai/schemastery'

export const name = 'my-custom-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'topla',
      description: 'İki sayıyı toplar.',
      parameters: Schema.object({
        a: Schema.number().description('Birinci sayı').required(),
        b: Schema.number().description('İkinci sayı').required()
      }),
      execute: async ({ a, b }) => {
        return `Toplam: ${a + b}`
      }
    })
  )
}
```

### 2. Presete Ekleyin:
`apps/cli/config/agent-presets/standard/agent.cordis.yml` dosyasının altına aracınızı tanımlayın:
```yaml
- id: my-custom-tool
  name: 'my-custom-tool'
```

---

## 🧠 Kendi Becerinizi (.agents/skills/) Nasıl Tanımlarsınız?

`.agents/skills/` klasörü altına yeni bir dizin ve `SKILL.md` dosyası ekleyin:

**Örnek: `.agents/skills/sql-expert/SKILL.md`**
```markdown
---
name: sql-expert
description: PostgreSQL ve veritabanı sorguları uzmanı becerisi.
---

# SQL Expert Skill
Bu beceri aktif olduğunda ajan veritabanı optimizasyonu kurallarına göre SQL yazar.
```

Ajan bu beceriyi otomatik olarak tanır ve gerektiğinde hafızasına yükler!
