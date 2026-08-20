import React, { useState, useEffect } from 'react'
import { Modal, Button, Badge } from '@custom-harness/client-ui-primitives'
import type { User, UserRole } from '@custom-harness/core-types'

export interface AdminOverviewStats {
  totalUsers: number
  adminCount: number
  userCount: number
  totalSessions: number
  totalUploads: number
  totalStorageBytes: number
  activeUsers24h: number
}

export interface AdminPanelModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: User | null
  users: User[]
  onSwitchUser: (userId: string) => Promise<void>
  onCreateUser: (data: { username: string; name: string; email?: string; role: UserRole; avatar?: string }) => Promise<void>
  onUpdateUserRole: (userId: string, role: UserRole) => Promise<void>
  onDeleteUser: (userId: string) => Promise<void>
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export function AdminPanelModal({
  isOpen,
  onClose,
  currentUser,
  users,
  onSwitchUser,
  onCreateUser,
  onUpdateUserRole,
  onDeleteUser,
  onShowToast
}: AdminPanelModalProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'sessions' | 'uploads' | 'overview'>('users')
  const [stats, setStats] = useState<AdminOverviewStats | null>(null)
  const [allSessions, setAllSessions] = useState<any[]>([])
  const [allUploads, setAllUploads] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // New user form state
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('user')
  const [newAvatar, setNewAvatar] = useState('👤')

  const fetchAdminData = async () => {
    if (!isOpen) return
    setIsLoading(true)
    try {
      const [statsRes, sessRes, upRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { 'X-User-Id': currentUser?.id || 'user_admin' } }),
        fetch('/api/admin/sessions', { headers: { 'X-User-Id': currentUser?.id || 'user_admin' } }),
        fetch('/api/admin/uploads', { headers: { 'X-User-Id': currentUser?.id || 'user_admin' } })
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (sessRes.ok) setAllSessions(await sessRes.json())
      if (upRes.ok) setAllUploads(await upRes.json())
    } catch (err: any) {
      console.error('[AdminPanel] Error fetching admin data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchAdminData()
    }
  }, [isOpen, activeTab])

  if (!isOpen) return null

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim()) {
      onShowToast('Kullanıcı adı boş bırakılamaz', 'error')
      return
    }
    try {
      await onCreateUser({
        username: newUsername.trim(),
        name: newName.trim() || newUsername.trim(),
        email: newEmail.trim(),
        role: newRole,
        avatar: newAvatar
      })
      setShowAddUserModal(false)
      setNewUsername('')
      setNewName('')
      setNewEmail('')
      onShowToast(`'${newUsername}' kullanıcısı oluşturuldu.`, 'success')
      fetchAdminData()
    } catch (err: any) {
      onShowToast(`Kullanıcı oluşturulamadı: ${err.message}`, 'error')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Bu oturumu kalıcı olarak silmek istediğinize emin misiniz?')) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'X-User-Id': currentUser?.id || 'user_admin' }
      })
      if (res.ok) {
        onShowToast('Oturum silindi', 'success')
        fetchAdminData()
      }
    } catch (err: any) {
      onShowToast(`Silme hatası: ${err.message}`, 'error')
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="modal-title-with-icon">
          <span>🛡️</span>
          <span>ArtificaX Yönetici Paneli (Enterprise Multi-Tenancy)</span>
        </div>
      }
      maxWidth="980px"
      footer={
        <div className="admin-footer-actions">
          <span className="admin-status-note">
            Aktif Yönetici: <strong>{currentUser?.name || currentUser?.username}</strong> ({currentUser?.role})
          </span>
          <Button variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </div>
      }
    >
      <div className="admin-panel-layout">
        {/* Admin Navigation Tabs */}
        <nav className="admin-nav-tabs">
          <button
            className={`admin-nav-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Kullanıcı & Rol Yönetimi ({users.length})
          </button>
          <button
            className={`admin-nav-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            💬 Tüm Sohbetler & Oturumlar ({allSessions.length})
          </button>
          <button
            className={`admin-nav-tab ${activeTab === 'uploads' ? 'active' : ''}`}
            onClick={() => setActiveTab('uploads')}
          >
            📁 Yüklenen Dosyalar ({allUploads.length})
          </button>
          <button
            className={`admin-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Sistem & Kaynak Durumu
          </button>
        </nav>

        {/* Tab 1: User Management */}
        {activeTab === 'users' && (
          <div className="admin-tab-pane">
            <div className="admin-pane-header">
              <div>
                <h3>Kayıtlı Kullanıcılar ve İzinler</h3>
                <p className="admin-pane-sub">
                  Kullanıcıları yönetin, rolleri değiştirin veya farklı bir kullanıcının çalışma alanına hızlı geçiş yapın.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowAddUserModal(true)}>
                ➕ Yeni Kullanıcı Ekle
              </Button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Kullanıcı</th>
                    <th>E-posta</th>
                    <th>Rol</th>
                    <th>Kiracı Dizini</th>
                    <th>Son Etkinlik</th>
                    <th style={{ textAlign: 'right' }}>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className={isSelf ? 'row-highlight' : ''}>
                        <td>
                          <div className="user-cell">
                            <span className="user-avatar-badge">{u.avatar || '👤'}</span>
                            <div>
                              <div className="user-name-title">
                                {u.name} {isSelf && <span className="self-tag">(Siz)</span>}
                              </div>
                              <div className="user-handle">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td>{u.email || '-'}</td>
                        <td>
                          <Badge variant={u.role === 'admin' ? 'purple' : 'cyan'}>
                            {u.role === 'admin' ? '🛡️ Yönetici' : '👤 Kullanıcı'}
                          </Badge>
                        </td>
                        <td>
                          <code className="code-snippet">~/.dsh/tenants/{u.id}/</code>
                        </td>
                        <td>
                          {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="action-button-group">
                            {!isSelf && (
                              <button
                                className="btn-table-action"
                                title="Bu Kullanıcı Olarak Oturum Aç"
                                onClick={() => {
                                  onSwitchUser(u.id)
                                  onClose()
                                }}
                              >
                                🔄 Geçiş Yap
                              </button>
                            )}
                            {u.username !== 'admin' && (
                              <button
                                className="btn-table-action"
                                title="Rolü Değiştir"
                                onClick={() => onUpdateUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')}
                              >
                                {u.role === 'admin' ? 'User Yap' : 'Admin Yap'}
                              </button>
                            )}
                            {u.username !== 'admin' && !isSelf && (
                              <button
                                className="btn-table-action danger"
                                title="Kullanıcıyı Sil"
                                onClick={() => {
                                  if (confirm(`'${u.name}' kullanıcısını silmek istediğinize emin misiniz?`)) {
                                    onDeleteUser(u.id)
                                  }
                                }}
                              >
                                🗑️ Sil
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: All Sessions */}
        {activeTab === 'sessions' && (
          <div className="admin-tab-pane">
            <div className="admin-pane-header">
              <div>
                <h3>Tüm Kiracı Sohbet Oturumları</h3>
                <p className="admin-pane-sub">Sistem genelinde açılmış tüm aktif ve geçmiş sohbetler.</p>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Oturum Başlığı</th>
                    <th>Sahip (Kullanıcı)</th>
                    <th>Çalışma Alanı</th>
                    <th>Son Güncelleme</th>
                    <th style={{ textAlign: 'right' }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {allSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Henüz kayıtlı oturum bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    allSessions.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="session-title-cell">
                            <span className="session-icon">💬</span>
                            <span className="session-title-text" title={s.title}>{s.title}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant="cyan">{s.userId || 'user_admin'}</Badge>
                        </td>
                        <td>
                          <code className="code-snippet">{s.workspace || '/workspace'}</code>
                        </td>
                        <td>
                          {s.updatedAt ? new Date(s.updatedAt).toLocaleString('tr-TR') : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-table-action danger"
                            onClick={() => handleDeleteSession(s.id)}
                            title="Oturumu Sil"
                          >
                            🗑️ Sil
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: All Uploads */}
        {activeTab === 'uploads' && (
          <div className="admin-tab-pane">
            <div className="admin-pane-header">
              <div>
                <h3>Kiracılar Genelinde Yüklenen Dosyalar</h3>
                <p className="admin-pane-sub">Tüm kullanıcıların analiz için yüklediği Excel, PDF ve Görseller.</p>
              </div>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>Dosya Adı</th>
                    <th>Kategori</th>
                    <th>Sahip (Kullanıcı)</th>
                    <th>Boyut</th>
                    <th>Oturum</th>
                    <th>Yerel Yol</th>
                  </tr>
                </thead>
                <tbody>
                  {allUploads.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Yüklenmiş dosya bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    allUploads.map((up, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{up.fileName}</strong>
                        </td>
                        <td>
                          <Badge variant={up.category === 'spreadsheet' ? 'success' : up.category === 'image' ? 'purple' : 'default'}>
                            {up.category || 'dosya'}
                          </Badge>
                        </td>
                        <td>
                          <Badge variant="cyan">{up.userId || 'user_admin'}</Badge>
                        </td>
                        <td>{formatBytes(up.fileSize)}</td>
                        <td>
                          <code className="code-snippet">{up.sessionId || '-'}</code>
                        </td>
                        <td>
                          <code className="code-snippet">{up.filePath}</code>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Overview & System Stats */}
        {activeTab === 'overview' && (
          <div className="admin-tab-pane">
            <div className="admin-overview-grid">
              <div className="admin-stat-card">
                <div className="stat-card-icon">👥</div>
                <div className="stat-card-body">
                  <div className="stat-card-value">{stats?.totalUsers || users.length}</div>
                  <div className="stat-card-label">Toplam Kayıtlı Kullanıcı</div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-card-icon">🛡️</div>
                <div className="stat-card-body">
                  <div className="stat-card-value">{stats?.adminCount || users.filter(u => u.role === 'admin').length}</div>
                  <div className="stat-card-label">Yönetici (Admin) Hesabı</div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-card-icon">💬</div>
                <div className="stat-card-body">
                  <div className="stat-card-value">{stats?.totalSessions || allSessions.length}</div>
                  <div className="stat-card-label">Toplam Sohbet Oturumu</div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-card-icon">📁</div>
                <div className="stat-card-body">
                  <div className="stat-card-value">{stats?.totalUploads || allUploads.length}</div>
                  <div className="stat-card-label">Toplam Yüklenen Belge</div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-card-icon">💾</div>
                <div className="stat-card-body">
                  <div className="stat-card-value">{formatBytes(stats?.totalStorageBytes || 0)}</div>
                  <div className="stat-card-label">Kiracı Depolama Alanı</div>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="stat-card-icon">⚡</div>
                <div className="stat-card-body">
                  <div className="stat-card-value">{stats?.activeUsers24h || 1}</div>
                  <div className="stat-card-label">Son 24s Aktif Kullanıcı</div>
                </div>
              </div>
            </div>

            <div className="admin-info-box">
              <h4>🔒 Multi-Tenancy Güvenlik & İzolasyon Mimarisi</h4>
              <p>
                ArtificaX, her kullanıcının çalışma alanını, yüklediği veri dosyalarını ve RAG vektör indekslerini
                <code>~/.dsh/tenants/{'{userId}'}/</code> kök dizini altında katı bir şekilde izole eder.
                Standart kullanıcılar yalnızca kendi kaynaklarına erişebilirken, Yöneticiler sistem bütünlüğünü denetleme
                ve kaynakları merkezi olarak yönetme yetkisine sahiptir.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add User Sub-Modal */}
      {showAddUserModal && (
        <div className="sub-modal-backdrop" onClick={() => setShowAddUserModal(false)}>
          <div className="sub-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sub-modal-header">
              <h4>➕ Yeni Kiracı / Kullanıcı Ekle</h4>
              <button className="btn-close-mini" onClick={() => setShowAddUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateUserSubmit} className="sub-modal-form">
              <div className="form-group">
                <label>Kullanıcı Adı (Benzersiz)</label>
                <input
                  type="text"
                  placeholder="örn: mehmet_yilmaz"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Ad Soyad / Görünen İsim</label>
                <input
                  type="text"
                  placeholder="örn: Mehmet Yılmaz"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>E-posta Adresi</label>
                <input
                  type="email"
                  placeholder="mehmet@artificax.ai"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Yetki / Rol</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)}>
                  <option value="user">👤 Standart Kullanıcı (İzole Alan)</option>
                  <option value="admin">🛡️ Yönetici (Admin - Tam Yetkili)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Avatar / Simge</label>
                <div className="avatar-picker">
                  {['👤', '🛡️', '💻', '📊', '🚀', '🧪', '🔍', '⚡'].map((av) => (
                    <button
                      key={av}
                      type="button"
                      className={`btn-avatar-pick ${newAvatar === av ? 'selected' : ''}`}
                      onClick={() => setNewAvatar(av)}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sub-modal-actions">
                <Button variant="secondary" onClick={() => setShowAddUserModal(false)}>
                  İptal
                </Button>
                <Button variant="primary" type="submit">
                  Kullanıcıyı Kaydet
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Modal>
  )
}
