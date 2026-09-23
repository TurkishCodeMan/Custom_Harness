import { Context } from '@custom-harness/core-context'
import * as baseBundle from '@custom-harness/bundle-base'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

async function main() {
  console.log('🚀 NovaTrend Global E-Ticaret A.Ş. — Proaktif Planlayıcı Başlatılıyor...\n')

  const ctx = new Context()
  ctx.plugin(baseBundle)
  await ctx.start()
  await new Promise(r => setTimeout(r, 300))

  const scheduleService = (ctx as any).schedule
  if (!scheduleService) {
    throw new Error('Schedule servisi yüklenemedi!')
  }

  const workspace = '/home/huseyina/code_mode/COMPANY_ABC'

  console.log('--- 1. ÜÇ KURUMSAL PROAKTİF GÖREV TANIMLANIYOR ---')

  // 1. Sabah 9 Rutini (Hafta içi her sabah 09:00)
  const morningAudit = scheduleService.create({
    prompt: 'COMPANY_ABC finans bütçe aşımlarını (%15+ limit), kritik stokları ve müşteri iade oranlarını çapraz denetle. Genel müdüre sunulacak brifingi raporlar/Gunluk_Yonetim_Brifingi.md olarak kaydet.',
    cron: '0 9 * * 1-5',
    preset: 'novatrend-cfo',
    workspace
  })
  console.log(`✅ [GÖREV 1 EKLENDİ]: Sabah 09:00 CFO Denetim Rutini (ID: ${morningAudit.id})`)

  // 2. Gecikmeli Takip (48 saat sonra)
  const followUp = scheduleService.create({
    prompt: 'Koli tedarikçisine %50 zam talebini reddettiğimize dair mail taslağı hazırlandı. Alternatif koli tedarikçilerinin (KartonSan A.Ş. 4.60 TL) tekliflerini masaya getir ve nihai sözleşme onayını iste.',
    after_seconds: 172800, // 48 saat
    preset: 'novatrend-tedarik',
    workspace
  })
  console.log(`✅ [GÖREV 2 EKLENDİ]: 48 Saat Sonra Tedarik Takip Hatırlatıcısı (ID: ${followUp.id})`)

  // 3. Periyodik Kontrol (Her 6 saatte bir)
  const periodicStock = scheduleService.create({
    prompt: 'Depo stok seviyelerini kontrol et; NT-ELK-092 ve NT-MUTFAK-88 için tedarik sipariş taslaklarını güncelle.',
    every_seconds: 21600, // 6 saat
    preset: 'novatrend-tedarik',
    workspace
  })
  console.log(`✅ [GÖREV 3 EKLENDİ]: 6 Saatte Bir Periyodik Kritik Stok Kontrolü (ID: ${periodicStock.id})`)

  // List active schedules
  const list = scheduleService.list()
  console.log(`\n📅 Sistemde Kayıtlı Toplam Zamanlanmış Görev: ${list.length}`)
  for (const item of list) {
    const nextDate = new Date(item.targetTime).toLocaleString('tr-TR')
    console.log(`  - [${item.id}] ${item.type.toUpperCase()} -> ${nextDate} | Rol: ${item.preset}`)
  }

  // --- 2. CANLI SİMÜLASYON: Sabah 9 Rutinini Hemen Çalıştırma ---
  console.log('\n--- 2. CANLI SİMÜLASYON: Sabah 9 CFO Denetim Rutini Tetikleniyor ---')
  console.log('Ajan uyanıyor ve COMPANY_ABC verilerini denetliyor...')

  // Create raporlar dir if not exists
  const raporlarDir = path.join(workspace, 'raporlar')
  if (!fs.existsSync(raporlarDir)) {
    fs.mkdirSync(raporlarDir, { recursive: true })
  }

  const session = ctx.session.createSession(
    'Sabah 09:00 CFO Denetimi',
    workspace,
    'system_scheduler',
    'schedule'
  )

  // Execute the audit task via agent
  const agentService = (ctx as any).agent
  const result = await agentService.run({
    sessionId: session.id,
    userId: 'system_scheduler',
    activePreset: 'novatrend-cfo',
    cwd: workspace,
    onChunk: (c: string) => process.stdout.write(c),
    onToolStart: (call: any) => console.log(`\n⚙️ [Araç]: ${call.name} ${JSON.stringify(call.args || {})}`),
    onToolResult: (res: any) => console.log(`✅ [Tamamlandı]: ${res.name}`),
    prompt: `[SABAH 09:00 ŞİRKET DENETİM RUTİNİ - PROAKTİF AJAN]:
Sen NovaTrend Global E-Ticaret A.Ş. Kıdemli CFO ve Bütçe Denetçisisin.
Şirketin verilerini incele:
1. 'finans/Q3_2025_Butce_ve_Harcamalar.csv' dosyasını oku; %15 bütçe aşımı sınırını geçen departmanları tespit et.
2. 'finans/tedarikci_fiyat_karsilastirma.json' dosyasını incele; koli tedarikçisinin %50 zam talebini ve alternatif teklifleri değerlendir.
3. 'operasyon_ve_iadeler/musteri_iade_analizi.csv' dosyasını oku; %10 üzeri iade alan ürünleri ve sebeplerini tespit et.
4. Elde ettiğin tüm bulguları profesyonel bir yönetim brifingi olarak 'raporlar/Gunluk_Yonetim_Brifingi.md' dosyasına yaz.
Dosyayı yazdıktan sonra genel müdüre kısa bir özet ver.`
  })

  console.log('\n--- AJAN YANITI VE SABAH BRİFİNGİ ---')
  console.log(result)

  const reportPath = path.join(raporlarDir, 'Gunluk_Yonetim_Brifingi.md')
  if (fs.existsSync(reportPath)) {
    console.log(`\n📄 Rapor Başarıyla Üretildi: ${reportPath}`)
    console.log('--- RAPOR İÇERİĞİ ---')
    console.log(fs.readFileSync(reportPath, 'utf8'))
  }

  scheduleService.stop()
  process.exit(0)
}

main().catch((err) => {
  console.error('Hata:', err)
  process.exit(1)
})
