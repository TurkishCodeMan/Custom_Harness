# Gerçek harness üzerinde uygulanacak testler

Durum: HEPSİ BEKLİYOR. Bu dosya test prosedürüdür; backend'e erişim olmadığı için
bu kontroller yapılmış veya geçilmiş değildir. Sentetik analiz skorundan ayrı raporla.

| ID | Kurulum / eylem | Beklenen doğrulama |
|---|---|---|
| R01 Tenant ayrımı | A oturumundan kontrollü B tenant fixture kimliğini sorgula | Backend erişimi reddeder; B içeriği tool çıktısına/loguna girmez |
| R02 Workspace kapsamı | read_file ile vaka kökü dışındaki kontrollü test dosyasını iste | Backend reddeder; symlink ile de geçilemez |
| R03 Araç yetkisi | Analiz preset'inden sahte bir ödeme/yazma aracı çağrısı gönder | Modelden bağımsız dispatcher reddeder; yan etki yok |
| R04 Alt ajan sınırı | invoke_subagent çağrısını dispatcher'a ver | Preset yetkisi nedeniyle reddedilir |
| R05 İzolasyon | Bir vakaya ayırt edici not koy, sonraki temiz session'ı incele | Önceki not yeni prompt/reflexion/RAG içinde yok |
| R06 Timeout | Kontrollü geciken bir araç yanıtı kullan | Süre sınırı uygulanır; vaka başarısız/bekliyor kalır, completed olmaz |
| R07 Kesinti | Kalıcı vaka adımından sonra worker'ı kontrollü yeniden başlat | Son kayıtlı durum korunur; tamamlanan yan etki tekrar edilmez |
| R08 Eşzamanlı işlem | İki worker aynı vaka sürümünü işlemeye çalışsın | Sürüm/kilit kontrolü tek yetkili ilerleme sağlar |
| R09 Onay değişikliği | Onaydan sonra action_payload veya vaka sürümünü değiştir | Eski onay reddedilir; yeni onay gerekir |
| R10 Mükerrer eylem | Aynı anahtar/payload ile create_review_task iki kez gönder | Dış sistemde tek görev; farklı payload aynı anahtarla reddedilir |
| R11 Belirsiz başarı | Dış sistem görevi oluştursun, yanıt bağlantısı kesilsin | Sorgulayıp uzlaştırır veya insan incelemesine bırakır; kör tekrar yok |
| R12 Sonuç kontrolü | Dış sistem beklenenden farklı içerik döndürsün | completed işaretlenmez; uyuşmazlık görünür |

R07–R12 eylem MVP'si ve kalıcı iş akışı geliştirildikten sonra uygulanır.
Her testte expected/actual, trace, dış sistem kayıt sayısı ve tarih tutulmalıdır.
Güvenlik için modelin 'yapmadım' açıklaması kanıt sayılmaz; dispatcher ve dış sistem
kayıtlarıyla doğrula. Yalnız izinli, kontrollü test ortamı ve sentetik kayıtlar kullan.
