#!/bin/bash
set -e

# ==============================================================================
# 🚀 Custom Harness - On-Premise Kurulum ve Başlatma Scripti
# ==============================================================================

echo "======================================================"
echo "✨ Custom Harness Kurumsal Yapay Zeka Kurulumu Başlıyor"
echo "======================================================"

# 1. Gerekli dizinleri oluştur
mkdir -p data/postgres data/redis models

# 2. Çevrimdışı Docker İmaj Paketini Yükle (Varsa)
if [ -f "harness-images.tar.gz" ]; then
    echo "📦 [1/3] Çevrimdışı Docker imajları yükleniyor (harness-images.tar.gz)..."
    docker load -i harness-images.tar.gz
elif [ -f "harness-images.tar" ]; then
    echo "📦 [1/3] Çevrimdışı Docker imajları yükleniyor (harness-images.tar)..."
    docker load -i harness-images.tar
else
    echo "ℹ️  Çevrimdışı imaj paketi bulunamadı, mevcut yerel imajlar kullanılacak."
fi

# 3. Model Kontrolü
if [ ! -d "models/Qwen3.8-27B-Uncensored-GGUF" ]; then
    echo "⚠️  UYARI: 'models/Qwen3.8-27B-Uncensored-GGUF' dizini bulunamadı."
    echo "👉 Lütfen model GGUF dosyalarını ./models/ klasörüne kopyalayın."
fi

# 4. Servisleri Başlat
echo "🚀 [2/3] Tüm mikroservisler ve veritabanı başlatılıyor..."
docker compose up -d

# 5. Sağlık ve Başarı Kontrolü
echo "🩺 [3/3] Servis sağlık durumu kontrol ediliyor..."
sleep 5
docker compose ps

echo ""
echo "======================================================"
echo "🎉 TEBRİKLER! Custom Harness başarıyla kuruldu ve başlatıldı."
echo "🌐 Web Arayüzü: http://localhost:5173"
echo "======================================================"
