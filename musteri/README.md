# 🚀 Custom Harness — On-Premise Kurumsal Kurulum Kılavuzu

Bu paket, **Custom Harness** yapay zeka ajanını internet bağlantısına ihtiyaç duymadan (Air-Gapped / On-Premise) kendi altyapınızda çalıştırmak için hazırlanmıştır.

Paket iki ana modda kullanılabilir:
- **CLI Modu (Terminal Kod Ajanı):** Geliştiriciler kendi terminalinden `dsh` komutuyla AI ajanını başlatır.
- **Web UI Modu:** Tarayıcı tabanlı sohbet arayüzü ve RAG servisleri (PostgreSQL + Redis gerektirir).

---

## 📋 Gereksinimler

| Gereksinim | CLI Modu | Web UI Modu |
| :--- | :---: | :---: |
| Docker Engine 24.0+ | ✅ | ✅ |
| NVIDIA GPU (24GB+ VRAM) | ❌ Opsiyonel | ✅ Zorunlu |
| Şirket içi LLM sunucusu | ✅ Zorunlu | ✅ Zorunlu |

---

## ⚡ Kurulum (Tek Komut)

```bash
chmod +x install.sh
./install.sh
```

Script sizi adım adım yönlendirir.

---

## 🖥️ CLI Modu — Terminal Kod Ajanı

### Kurulum Sonrası Tek Seferlik Yapılandırma

`install.sh` çalıştırıldığında `config.env` dosyası **paketin bulunduğu klasörde** otomatik oluşturulur.
**`dsh` komutunu ilk kez kullanmadan önce** bu dosyayı düzenleyip LLM sunucu bilgilerinizi girin:

```bash
# install.sh'ın çıktısında tam yol gösterilir, örnek:
nano /home/kullanici/harness/config.env
```

```env
OPENAI_BASE_URL=http://192.168.1.100:8004/v1   # Şirket içi LLM sunucu adresi
OPENAI_API_KEY=dahili-api-anahtari
DEFAULT_MODEL=qwen3.8-27b-uncensored
```

> **Not:** Config dosyası paketi açtığınız klasörde durur — başka bir yere kopyalamanıza gerek yok.
> Bu tek seferlik bir işlemdir. Sonraki kullanımlarda sadece `dsh` yazmanız yeterlidir.

---

### Günlük Kullanım

Projenizin klasörüne gidin ve `dsh` yazın — başka hiçbir şeye gerek yok:

```bash
cd /projeleriniz/yeni-proje
dsh
```

Ajan o klasörü çalışma alanı olarak bağlar ve `dsh >` promptu açılır.

### Neler Yapabilirsiniz?

```
dsh > /goal -b "Bu Django projesine JWT kimlik doğrulama ekle ve testleri yaz"
dsh > /yolo   # Onay sormadan otonom çalışma modu
dsh > /help   # Tüm komutlar
```

### Güvenlik Notu

Ajan yalnızca `cd` ile girdiğiniz proje klasörüne erişebilir. Sistemin geri kalanı tamamen izoledir.

---

## 🌐 Web UI Modu

```bash
# Servisleri başlat
docker compose up -d

# Tarayıcıda açın
open http://localhost:5173
```

### Port Haritası

| Servis | Port |
| :--- | :--- |
| Web Arayüzü | 5173 |
| LLM API | 8004 |
| pgvector DB | 15432 |
| Redis | 16379 |

---

## 🔄 Güncelleme ve Yönetim

```bash
# CLI imajını yenile
docker pull custom-harness-cli:v1.0.0   # veya yeni imaj yükle

# Web servislerini durdur/başlat
docker compose down
docker compose up -d

# Canlı loglar
docker compose logs -f custom-harness-app
```

---

## 🆘 Sorun Giderme

**`dsh` komutu bulunamadı:**
```bash
sudo cp dsh /usr/local/bin/dsh && sudo chmod +x /usr/local/bin/dsh
```

**Ajan LLM'e bağlanamıyor:**
```bash
# Config dosyanızı kontrol edin:
cat ~/.config/dsh/config.env
# LLM sunucusuna ulaşılabilir mi test edin:
curl http://192.168.1.100:8004/v1/models
```

**Container'dan çıkmak:**
`Ctrl+D` veya `exit` yazın.
