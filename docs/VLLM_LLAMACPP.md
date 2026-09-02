cd /home/huseyina/code_mode/custom-harness

# 1. Qwen konteynerini durdurun (GPU'ları ve 8004 portunu boşa çıkarmak için):
docker rm -f harness-qwen

# 2. Gemma'yı 1 kopya (aktif) olarak başlatın:
docker compose -f docker-compose.services.yml up -d --scale service-gemma=1 service-gemma

# 3. Gemma'nın yüklenme loglarını izleyin:
docker logs -f harness-gemma



## QWEN UP
cd /home/huseyina/code_mode/custom-harness

# 1. Servisi başlatın:
docker compose -f docker-compose.services.yml up -d service-qwen

# 2. Modelin 4 GPU'ya dağılarak yüklenmesini takip edin:
docker logs -f harness-qwen
