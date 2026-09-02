#!/bin/bash
set -e

# ==============================================================================
# 📦 Custom Harness - Çevrimdışı (On-Prem) Müşteri Paketi Üretici
# ==============================================================================

ROOT_DIR="/home/huseyina/code_mode/custom-harness"
MUSTERI_DIR="${ROOT_DIR}/musteri"

echo "======================================================"
echo "🚀 Custom Harness On-Premise Paketleme Başlıyor"
echo "Hedef: ${MUSTERI_DIR}"
echo "======================================================"

cd "${ROOT_DIR}"

# 1. Kaynak Kodları Derle ve Gizle (dist/ klasörü üretimi)
echo "📦 [1/4] TypeScript kaynak kodları derleniyor ve karartılıyor (pnpm build)..."
pnpm build

# 2. Custom Harness App Docker İmajını Derle
echo "🐳 [2/4] custom-harness-app:v1.0.0 Docker imajı derleniyor..."
docker build -t custom-harness-app:v1.0.0 -f musteri/Dockerfile.app .

# 3. Bağımlı Mikroservis İmajlarını Derle
echo "🛠️  [3/4] Mikroservis imajları derleniyor (OCR, Reranker, Image Search)..."
docker build -t custom-harness-ocr:v1.0.0 services/ocr-service/
docker build -t custom-harness-reranker:v1.0.0 services/reranker-service/
docker build -t custom-harness-image-search:v1.0.0 services/image-search-service/

# 4. Tüm İmajları Tek Bir Arşiv Dosyasına Kaydet
echo "🗜️  [4/4] Tüm Docker imajları ${MUSTERI_DIR}/harness-images.tar.gz olarak arşivleniyor..."
rm -f "${MUSTERI_DIR}/harness-images.tar" "${MUSTERI_DIR}/harness-images.tar.gz"

docker save -o "${MUSTERI_DIR}/harness-images.tar" \
  custom-harness-app:v1.0.0 \
  custom-harness-ocr:v1.0.0 \
  custom-harness-reranker:v1.0.0 \
  custom-harness-image-search:v1.0.0 \
  pgvector/pgvector:pg16 \
  redis:7-alpine

# Sıkıştır
if command -v pigz &> /dev/null; then
    pigz -f -p 8 "${MUSTERI_DIR}/harness-images.tar"
else
    gzip -f "${MUSTERI_DIR}/harness-images.tar"
fi

echo "======================================================"
echo "🎉 TEBRİKLER! Müşteri Paketi Başarıyla Hazırlandı:"
ls -lh "${MUSTERI_DIR}/harness-images.tar.gz"
echo "======================================================"
