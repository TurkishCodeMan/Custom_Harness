#!/bin/bash
set -e

# ==============================================================================
# 🚀 Custom Harness - On-Premise Kurulum ve Başlatma Scripti
# Web UI + CLI Agent kurulumunu birlikte yapar
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================================"
echo "✨ Custom Harness Kurumsal Yapay Zeka Kurulumu Başlıyor"
echo "======================================================"

# 1. Gerekli dizinleri oluştur
mkdir -p data/postgres data/redis models

# 2. Çevrimdışı Docker İmaj Paketini Yükle (CLI + Web UI imajları dahil)
if [ -f "harness-images.tar.gz" ]; then
    echo "📦 [1/5] Çevrimdışı Docker imajları yükleniyor (harness-images.tar.gz)..."
    docker load -i harness-images.tar.gz
elif [ -f "harness-images.tar" ]; then
    echo "📦 [1/5] Çevrimdışı Docker imajları yükleniyor (harness-images.tar)..."
    docker load -i harness-images.tar
else
    echo "ℹ️  Çevrimdışı imaj paketi bulunamadı, mevcut yerel imajlar kullanılacak."
fi

# 3. Config dosyasını paket içinde oluştur (müşteri burada düzenlecek)
echo "⚙️  [2/5] Config dosyası hazırlanıyor..."
if [ ! -f "$SCRIPT_DIR/config.env" ]; then
    cp "$SCRIPT_DIR/config.env.example" "$SCRIPT_DIR/config.env"
    echo "   ✅ config.env oluşturuldu: $SCRIPT_DIR/config.env"
    echo ""
    echo "   ⚠️  LÜTFEN YAPILACAK: LLM sunucu bilgilerinizi aşağıdaki dosyaya girin:"
    echo "   nano $SCRIPT_DIR/config.env"
    echo ""
else
    echo "   ℹ️  config.env zaten mevcut (atlanıyor): $SCRIPT_DIR/config.env"
fi

# 4. 'dsh' komutunu sistem geneline kur (SCRIPT_DIR inject edilerek)
echo "🔧 [3/5] 'dsh' CLI komutu sisteme kuruluyor..."

# Geçici kopya üzerinde placeholder'ları gerçek yolla değiştir
TMP_DSH=$(mktemp)
cp "$SCRIPT_DIR/dsh" "$TMP_DSH"
sed -i "s|__DSH_INSTALL_DIR__|$SCRIPT_DIR|g" "$TMP_DSH"

if [ -w "/usr/local/bin" ]; then
    mv "$TMP_DSH" /usr/local/bin/dsh
    chmod +x /usr/local/bin/dsh
else
    sudo mv "$TMP_DSH" /usr/local/bin/dsh
    sudo chmod +x /usr/local/bin/dsh
fi
echo "   ✅ 'dsh' komutu /usr/local/bin/dsh olarak kuruldu."
echo "   📍 Config konumu: $SCRIPT_DIR/config.env"

# 5. (Opsiyonel) Web UI servisleri başlat
echo ""
read -r -p "🌐 Web UI servislerini de başlatmak ister misiniz? (Veritabanı + LLM gerektir) [e/H]: " START_WEB
if [[ "$START_WEB" =~ ^[Ee]$ ]]; then
    if [ ! -d "models/Qwen3.8-27B-Uncensored-GGUF" ]; then
        echo "⚠️  UYARI: 'models/Qwen3.8-27B-Uncensored-GGUF' dizini bulunamadı."
        echo "👉 Lütfen model GGUF dosyalarını ./models/ klasörüne kopyalayın."
    fi

    mkdir -p data/postgres data/redis
    echo "🚀 [4/5] Web UI servisleri başlatılıyor..."
    docker compose up -d
    sleep 5
    docker compose ps
    echo "   🌐 Web Arayüzü: http://localhost:5173"
fi

echo ""
echo "======================================================"
echo "🎉 Custom Harness başarıyla kuruldu!"
echo ""
echo "📁 CLI Kullanımı (Terminal Kod Ajanı):"
echo "   1. Config dosyanızı düzenleyin: nano ~/.config/dsh/config.env"
echo "   2. Projenizin klasörüne gidin:  cd /sizin/projeniz"
echo "   3. Ajanı başlatın:             dsh"
echo ""
echo "💡 İpucu: Herhangi bir projenin klasöründeyken 'dsh' yazın."
echo "   Ajan o klasörü otomatik çalışma alanı olarak kullanır."
echo "======================================================"
