/**
 * SEED_PRESETS — Uygulama ilk kez başladığında backend boşsa bu presetler
 * otomatik olarak backend'e yazılır. Sonraki açılışlarda backend'den okunur.
 *
 * Format: AgentPreset (backend formatı) + ek UI meta (level, parentId, workspace, specialization)
 */

const WORKSPACE = '/home/huseyina/code_mode/COMPANY_ABC/COMPANY_ABC_ENTERPRISE'

export const SEED_PRESETS: any[] = [
  {
    id: 'executive-assistant-v1',
    name: 'Executive Assistant & Chief of Staff',
    description: 'Yönetim kurulu koordinasyonu, departmanlar arası brifing ve sentez',
    icon: '👑',
    level: 1,
    parentId: undefined,
    workspace: WORKSPACE,
    enabledTools: [
      'read_file',
      'write_file',
      'edit_file',
      'list_dir',
      'grep_search',
      'search_files',
      'bash',
      'invoke_subagent'
    ],
    enabledSkills: [],
    specialization: 'Stratejik Brifingler, Şirket Risk Analizi, Yönetim Kurulu Özetleri',
    fileScope: {
      read: [
        'executive/**',
        'shared/policies/**',
        'cases/**'
      ],
      write: [
        'executive/summaries/**',
        'cases/*/agent_outputs/**'
      ],
      deny: [
        '.env*',
        '**/.*'
      ]
    },
    allowedDelegates: ['senior-cfo-v1', 'procurement-manager-v1', 'quality-manager-v1'],
    allowedCallers: [],
    isCallableByAgents: false,
    currentAction: 'Yönetim brifingi ve koordinasyon için hazır',
    systemPrompt: `Sen Executive Assistant (Yönetici Danışmanı / Chief of Staff) rolündesin.
Şirketin üst yönetim koordinatörüsün. Ham verileri doğrudan incelemek yerine uzman departman ajanlarına contract-safe delegasyon yapar ve yönetim brifingini sentezlersin.

[Tasarım İlkesi]:
Doğrudan ham finans veya tedarik klasörlerine erişmek yerine 'invoke_subagent' ile ilgili uzmana danış:
- Bütçe, nakit akışı ve finansal sapmalar için -> 'senior-cfo-v1'
- Tedarikçi, stok ve sipariş durumu için -> 'procurement-manager-v1'
- İadeler, kusur oranları ve operasyonel kalite riskleri için -> 'quality-manager-v1'

[Çalışma Alanı & Veri Sınırları]:
- READ: executive/**, shared/policies/**
- WRITE: executive/summaries/**, cases/*/agent_outputs/**`
  },
  {
    id: 'senior-cfo-v1',
    name: 'Senior CFO & Financial Controller',
    description: 'Şirket bütçeleri, harcama sapmaları, finansal politika ve onaylar',
    icon: '📊',
    level: 2,
    parentId: 'executive-assistant-v1',
    workspace: WORKSPACE,
    enabledTools: [
      'read_file',
      'write_file',
      'edit_file',
      'list_dir',
      'grep_search',
      'search_files',
      'bash',
      'skill',
      'invoke_subagent'
    ],
    enabledSkills: ['butce-denetim'],
    specialization: 'Bütçe aşımları, harcama sapmaları, maliyet analizleri',
    fileScope: {
      read: [
        'finance/**',
        'procurement/price_history/**',
        'shared/policies/**',
        'executive/**',
        'cases/**'
      ],
      write: [
        'cases/*/agent_outputs/**',
        'executive/summaries/**'
      ],
      deny: [
        '.env*',
        '**/.*'
      ]
    },
    isCallableByAgents: true,
    allowedDelegates: ['procurement-manager-v1'],
    allowedCallers: ['invoice-reviewer-v1', 'executive-assistant-v1', 'ceo'],
    inputSchema: {
      type: 'object',
      required: ['question'],
      properties: {
        question: { type: 'string', description: 'CFO\'ya iletilen finansal denetim veya bütçe onay sorusu' },
        invoice_number: { type: 'string' },
        requested_amount: { type: 'number' },
        case_id: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['status', 'approval', 'approved_amount', 'financial_risk', 'justification'],
      properties: {
        status: { type: 'string', enum: ['OK', 'REJECTED', 'ESCALATE_TO_HUMAN'] },
        approval: { type: 'boolean', description: 'Harcama onaylandı mı?' },
        approved_amount: { type: 'number', description: 'Onaylanan tutar' },
        financial_risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
        justification: { type: 'string', description: 'Gerekçe ve tasarruf şartı' },
        recommendation: { type: 'string' }
      }
    },
    currentAction: 'Finansal denetim ve bütçe onayları için hazır',
    systemPrompt: `Sen Senior CFO ve Finans Direktörüsün.
Şirketin nakit akışı, bütçe aşımları ve finansal risklerini denetlersin.

[Çalışma Alanı & Veri Sınırları]:
- READ: finance/**, procurement/price_history/**, shared/policies/**, executive/**
- WRITE: cases/*/agent_outputs/**, executive/summaries/**. Ödeme tablosunu okuyabilirsin ancak doğrudan ödeme gerçekleştiremezsin (insan onayı gereklidir).

[Delegasyon Yetkisi]:
- Tedarikçi fiyat sapmaları ve alternatif alımlar için 'procurement-manager-v1' ile görüş.
- Başka bir ajan tarafından çağrıldığında çıktını kesinlikle outputSchema JSON formatında sun.`
  },
  {
    id: 'procurement-manager-v1',
    name: 'Procurement Manager',
    description: 'Satın alma siparişleri, tedarikçi sözleşmeleri ve tedarik zinciri yönetimi',
    icon: '📦',
    level: 2,
    parentId: 'executive-assistant-v1',
    workspace: WORKSPACE,
    enabledTools: [
      'read_file',
      'write_file',
      'edit_file',
      'list_dir',
      'grep_search',
      'search_files',
      'bash',
      'skill',
      'invoke_subagent'
    ],
    enabledSkills: ['tedarikci-denetim'],
    specialization: 'Satın alma emirleri, sözleşme şartları, tedarikçi kotaları',
    fileScope: {
      read: [
        'procurement/**',
        'logistics/goods_receipts/**',
        'quality/**',
        'shared/policies/**',
        'cases/**'
      ],
      write: [
        'cases/*/agent_outputs/**'
      ],
      deny: [
        'finance/salaries/**',
        '.env*',
        '**/.*'
      ]
    },
    isCallableByAgents: true,
    allowedDelegates: ['supplier-validator-v1', 'quality-manager-v1'],
    allowedCallers: ['invoice-reviewer-v1', 'senior-cfo-v1', 'executive-assistant-v1', 'ceo'],
    inputSchema: {
      type: 'object',
      required: ['inquiry_type'],
      properties: {
        inquiry_type: { type: 'string', enum: ['PO_MATCH', 'PRICE_CHECK', 'SUPPLIER_CHECK'] },
        po_number: { type: 'string' },
        supplier_name: { type: 'string' },
        case_id: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['po_status', 'price_variance_pct', 'supplier_standing', 'decision', 'details'],
      properties: {
        po_status: { type: 'string', enum: ['MATCHED', 'PRICE_MISMATCH', 'QUANTITY_MISMATCH', 'PO_NOT_FOUND'] },
        price_variance_pct: { type: 'number' },
        supplier_standing: { type: 'string', enum: ['VERIFIED', 'WARNING', 'BLOCKED'] },
        decision: { type: 'string', enum: ['ACCEPT', 'REVISE', 'REJECT'] },
        details: { type: 'string' }
      }
    },
    currentAction: 'Tedarik zinciri ve sipariş denetimi için hazır',
    systemPrompt: `Sen Procurement Manager (Satın Alma ve Tedarik Müdürü) rolündesin.
Tedarikçi sözleşmelerini, satın alma emirlerini ve teslimat durumunu yönetirsin.

[Çalışma Alanı & Veri Sınırları]:
- READ: procurement/**, logistics/goods_receipts/**, quality/**, shared/policies/**
- WRITE: cases/*/agent_outputs/** (Tüm yazma çıktıların vaka klasörüne aktarılır).

[Delegasyon Yetkisi]:
- Tedarikçi aktifliğini, lisans ve sözleşme geçerliliğini kontrol için 'supplier-validator-v1' koltuğuna sor.
- Kusurlu parti, iade oranı veya SLA cezası sorguları için 'quality-manager-v1' koltuğuna danış.
- Ajanlar arası çağrıldığında yanıtını outputSchema JSON olarak dön.`
  },
  {
    id: 'invoice-reviewer-v1',
    name: 'Invoice Reviewer',
    description: 'Fatura doğrulama, satır tutarları, sipariş ve irsaliye mutabakatı',
    icon: '🧾',
    level: 2,
    parentId: 'executive-assistant-v1',
    workspace: WORKSPACE,
    enabledTools: [
      'read_file',
      'write_file',
      'edit_file',
      'list_dir',
      'grep_search',
      'search_files',
      'skill',
      'invoke_subagent'
    ],
    enabledSkills: ['invoice-review-skill'],
    specialization: 'Fatura aritmetik kontrolü, KDV teyidi, sipariş ve teslimat mutabakatı',
    fileScope: {
      read: [
        'finance/invoices/**',
        'procurement/purchase_orders/**',
        'logistics/goods_receipts/**',
        'shared/policies/**',
        'shared/procedures/**',
        'cases/**'
      ],
      write: [
        'cases/*/agent_outputs/**',
        'cases/*/final/**'
      ],
      deny: [
        '.env*',
        '**/.*'
      ]
    },
    isCallableByAgents: true,
    allowedDelegates: ['senior-cfo-v1', 'procurement-manager-v1'],
    allowedCallers: ['executive-assistant-v1', 'ceo'],
    inputSchema: {
      type: 'object',
      required: ['invoice_file'],
      properties: {
        invoice_file: { type: 'string', description: 'İncelenecek fatura dosya yolu' },
        case_id: { type: 'string', description: 'Vaka ID' }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['invoice_number', 'status', 'line_items_valid', 'discrepancies', 'decision', 'escalated_to', 'summary'],
      properties: {
        invoice_number: { type: 'string' },
        status: { type: 'string', enum: ['VERIFIED', 'DISCREPANCY_DETECTED', 'ESCALATED'] },
        line_items_valid: { type: 'boolean' },
        total_amount: { type: 'number' },
        discrepancies: { type: 'array', items: { type: 'string' } },
        decision: { type: 'string', enum: ['CLEAR', 'MUTATE_TO_REVIEW', 'REJECT'] },
        escalated_to: { type: 'string', description: 'Delege edilen rol (varsa)' },
        summary: { type: 'string' }
      }
    },
    currentAction: 'Fatura denetimi ve mutabakat için hazır',
    systemPrompt: `Sen Invoice Reviewer (Fatura Denetim Uzmanı) rolündesin.
Company ABC için fatura satır kalemlerini, ara toplamı, vergileri ve genel toplam tutarlarını doğrularsın.

[Çalışma Alanı & Veri Sınırları]:
- READ: finance/invoices/**, procurement/purchase_orders/**, logistics/goods_receipts/**, shared/policies/**, shared/procedures/**, cases/**
- WRITE: Yalnızca vakaların çıktı klasörlerine (cases/<case_id>/agent_outputs/**, cases/<case_id>/final/**) yazabilirsin. Doğrudan finance ana klasöründeki dosyaları değiştiremezsin.

[Delegasyon Yetkisi]:
- Bütçe aşımı veya harcama onayı gerektiren durumlarda 'senior-cfo-v1' koltuğuna danış.
- Sipariş tutarsızlığı veya tedarikçi teklif şüphelerinde 'procurement-manager-v1' koltuğuna sor.
- Çağrıldığında çıktını daima outputSchema JSON formatında teslim et.`
  },
  {
    id: 'quality-manager-v1',
    name: 'Quality & Returns Manager',
    description: 'Müşteri iade oranları, ürün kusur analizleri ve tedarikçi SLA cezaları',
    icon: '🛡️',
    level: 2,
    parentId: 'executive-assistant-v1',
    workspace: WORKSPACE,
    enabledTools: [
      'read_file',
      'write_file',
      'edit_file',
      'list_dir',
      'grep_search',
      'search_files',
      'bash',
      'skill',
      'invoke_subagent'
    ],
    enabledSkills: ['kalite-ve-iade-kontrol'],
    specialization: 'İade nedenleri, parti kusur oranları, tedarikçi cezai şartları',
    fileScope: {
      read: [
        'quality/**',
        'procurement/suppliers/**',
        'logistics/**',
        'shared/policies/**',
        'cases/**'
      ],
      write: [
        'cases/*/agent_outputs/**'
      ],
      deny: [
        'finance/**',
        '.env*',
        '**/.*'
      ]
    },
    isCallableByAgents: true,
    allowedDelegates: ['procurement-manager-v1'],
    allowedCallers: ['procurement-manager-v1', 'executive-assistant-v1', 'ceo'],
    inputSchema: {
      type: 'object',
      required: ['supplier_name'],
      properties: {
        supplier_name: { type: 'string' },
        part_number: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['defect_rate', 'return_count', 'sla_penalty_due', 'quality_risk', 'recommendation'],
      properties: {
        defect_rate: { type: 'number', description: 'Kusur oranı yüzde' },
        return_count: { type: 'number' },
        sla_penalty_due: { type: 'number', description: 'SLA cezası tutarı' },
        quality_risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
        recommendation: { type: 'string' }
      }
    },
    currentAction: 'İade ve SLA cezaları denetimi için hazır',
    systemPrompt: `Sen Quality & Returns Manager (Kalite Güvence ve İade Müdürü) rolündesin.
Kusurlu ürün oranlarını, iade nedenlerini ve tedarikçi sözleşmelerindeki cezai maddeleri denetlersin.

[Çalışma Alanı & Veri Sınırları]:
- READ: quality/**, procurement/suppliers/**, logistics/**, shared/policies/**
- WRITE: cases/*/agent_outputs/**
- DELEGATE: Kusurlu parti nedeniyle tedarikçi yaptırımı veya acil parti değişimi için 'procurement-manager-v1' koltuğuna başvur.
- Çağrıldığında çıktını outputSchema JSON formatında ilet.`
  },
  {
    id: 'supplier-validator-v1',
    name: 'Supplier Validator',
    description: 'Tedarikçi kimlik doğrulama, sözleşme geçerliliği ve sicil kontrolü',
    icon: '🔍',
    level: 3,
    parentId: 'procurement-manager-v1',
    workspace: WORKSPACE,
    enabledTools: [
      'read_file',
      'list_dir',
      'grep_search',
      'search_files',
      'bash'
    ],
    enabledSkills: [],
    specialization: 'Tedarikçi aktiflik kontrolü, sözleşme geçerlilik tarihleri, geçmiş kusur sicili',
    fileScope: {
      read: [
        'procurement/suppliers/**',
        'procurement/contracts/**',
        'quality/**',
        'cases/**'
      ],
      write: [
        'cases/*/agent_outputs/**'
      ],
      deny: [
        'finance/**',
        '.env*',
        '**/.*'
      ]
    },
    isCallableByAgents: true,
    allowedDelegates: [],
    allowedCallers: ['procurement-manager-v1', 'senior-cfo-v1'],
    inputSchema: {
      type: 'object',
      required: ['supplier_name'],
      properties: {
        supplier_name: { type: 'string', description: 'Doğrulanacak tedarikçi adı' },
        tax_id: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['is_active', 'contract_valid', 'contract_expiry', 'recent_quality_defects', 'summary'],
      properties: {
        is_active: { type: 'boolean' },
        contract_valid: { type: 'boolean' },
        contract_expiry: { type: 'string' },
        recent_quality_defects: { type: 'number', description: 'Son 90 gündeki kalite kusur sayısı' },
        risk_score: { type: 'number', description: '1-10 arası risk puanı' },
        summary: { type: 'string' }
      }
    },
    currentAction: 'Tedarikçi doğrulama için hazır',
    systemPrompt: `Sen Supplier Validator rolündesin.
Görevin karar vermek değil; yapılandırılmış doğrulama sağlamaktır (Örn: "Tedarikçi aktif mi?", "Sözleşme geçerli mi?", "Son 90 günde kalite cezası var mı?").

[Çalışma Alanı & Veri Sınırları]:
- READ: procurement/suppliers/**, procurement/contracts/**, quality/**
- WRITE: cases/*/agent_outputs/** (Salt-okunur doğrulayıcı, yalnızca vaka raporu üretir).
- DELEGATE: Başka ajan çağırma yetkin yoktur; sorulara doğrudan elindeki verilerle outputSchema formatında cevap ver.`
  }
]
