# 🚀 Custom Harness - On-Premise Kurumsal Kurulum Kılavuzu

Bu paket, **Custom Harness** yapay zeka platformunu internet bağlantısına ihtiyaç duymadan (Air-Gapped / On-Premise) kendi sunucunuzda çalıştırmak için hazırlanmıştır.

---

## 📋 Gereksinimler

1. **İşletim Sistemi:** Linux (Ubuntu 22.04 LTS veya Debian 12 önerilir)
2. **Docker:** Docker Engine 24.0+ ve Docker Compose V2
3. **GPU Sürücüsü:** NVIDIA Driver (535+) ve NVIDIA Container Toolkit (nvidia-docker2)
4. **Donanım:** 1x veya daha fazla NVIDIA GPU (En az 24GB VRAM)

---

## ⚡ Hızlı Kurulum (Tek Tıkla)

### 1. Adım: Model Ağırlıklarını Yerleştirin
Model GGUF dosyalarını `./models/` dizini altına kopyalayın:
```text
musteri/models/Qwen3.8-27B-Uncensored-GGUF/
├── Qwen3.8-27B-Uncensored-Q4_K_M.gguf
└── mmproj-Qwen3.8-27B-Uncensored-f16.gguf
```

### 2. Adım: Kurulum Scriptini Çalıştırın
```bash
chmod +x install.sh
./install.sh
```

---

## 🌐 Erişim ve Yönetim

* **Web Kullanıcı Arayüzü:** `http://<sunucu-ip>:5173`
* **Vektör Veritabanı (pgvector):** Port `15432`
* **İş Kuyruğu (Redis):** Port `16379`
* **LLM API (OpenAI Uyumlu):** `http://<sunucu-ip>:8004/v1`

---

## 🛑 Durdurma ve Yeniden Başlatma

```bash
# Durdurmak için:
docker compose down

# Yeniden başlatmak için:
docker compose up -d

# Canlı logları izlemek için:
docker compose logs -f
```
