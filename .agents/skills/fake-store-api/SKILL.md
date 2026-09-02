---
name: fake-store-api
description: E-Ticaret Mağaza API'sine (DummyJSON) bağlanarak ürünleri, stokları, fiyatları ve kullanıcı sepetlerini sorgular.
---

# 🛒 Fake Store REST API Entegrasyon Rehberi

Kullanıcı ürün, stok, fiyat, kategori veya sipariş/sepet sorguladığında, aşağıdaki `curl` endpoint'lerini `bash` aracı ile çalıştırarak canlı veriyi çek ve kullanıcıya Türkçe, anlaşılır ve tablolu olarak sun.

---

## 📡 API Uç Noktaları (Endpoints)

### 1. Ürün Arama ve Listeleme
- **Tüm Ürünleri Listele (İlk 10):**
  ```bash
  curl -s "https://dummyjson.com/products?limit=10"
  ```
- **İsme Göre Ürün Ara:**
  ```bash
  curl -s "https://dummyjson.com/products/search?q=<ARANAN_KELİME>"
  ```
- **Kategoriye Göre Listele (Örn: laptops, smartphones, fragrances):**
  ```bash
  curl -s "https://dummyjson.com/products/category/<KATEGORİ>"
  ```

### 2. Tekil Ürün Detayı & Stok Kontrolü
- **ID ile Ürün Detayı:**
  ```bash
  curl -s "https://dummyjson.com/products/<URUN_ID>"
  ```

### 3. Kullanıcılar ve Siparişler (Carts)
- **Kullanıcı Listesi:**
  ```bash
  curl -s "https://dummyjson.com/users?limit=5"
  ```
- **Aktif Sepetler / Siparişler:**
  ```bash
  curl -s "https://dummyjson.com/carts?limit=5"
  ```

---

## 🎯 Yanıt Formatı:
API'den dönen JSON verisini ayrıştırıp kullanıcıya şu formatta sun:
1. **Ürün Adı ve Fiyatı ($)**
2. **Kategori ve Marka**
3. **Mevcut Stok Durumu (Stock)**
4. **Kullanıcı Puanı (Rating ⭐)**
