import React, { useState } from 'react'
import { Modal, Button, Badge } from '@custom-harness/client-ui-primitives'
import type { User, UserRole } from '@custom-harness/core-types'

export interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: (credentials: { username: string; password?: string }) => Promise<void>
  onRegister: (data: { username: string; name: string; email?: string; password?: string; role?: UserRole; avatar?: string }) => Promise<void>
  onQuickLogin: (userId: string) => Promise<void>
  availableDemoUsers?: User[]
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void
  isClosable?: boolean
}

export function AuthModal({
  isOpen,
  onClose,
  onLogin,
  onRegister,
  onQuickLogin,
  availableDemoUsers = [],
  onShowToast,
  isClosable = true
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [avatar, setAvatar] = useState('👤')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (!isOpen) return null

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setErrorMessage('Lütfen kullanıcı adınızı girin.')
      return
    }
    setIsLoading(true)
    setErrorMessage('')
    try {
      await onLogin({ username: username.trim(), password })
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Giriş yapılamadı')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) {
      setErrorMessage('Lütfen kullanıcı adı belirleyin.')
      return
    }
    setIsLoading(true)
    setErrorMessage('')
    try {
      await onRegister({
        username: username.trim(),
        name: name.trim() || username.trim(),
        email: email.trim(),
        password,
        role,
        avatar
      })
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Kayıt oluşturulamadı')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickDemoClick = async (userId: string) => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      await onQuickLogin(userId)
      onClose()
    } catch (err: any) {
      setErrorMessage(err.message || 'Hızlı giriş başarısız')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isClosable={isClosable}
      title={
        <div className="modal-title-with-icon">
          <span>🔐</span>
          <span>{mode === 'login' ? 'ArtificaX Giriş Yap' : 'Yeni Kiracı Hesabı Oluştur'}</span>
        </div>
      }
      maxWidth="480px"
    >
      <div className="auth-modal-container">
        {/* Toggle Mode */}
        <div className="auth-toggle-pill">
          <button
            type="button"
            className={`btn-auth-toggle ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login')
              setErrorMessage('')
            }}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            className={`btn-auth-toggle ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setMode('register')
              setErrorMessage('')
            }}
          >
            Kayıt Ol (Yeni Kiracı)
          </button>
        </div>

        {errorMessage && (
          <div className="auth-error-alert">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="form-group">
              <label>Kullanıcı Adı veya E-posta</label>
              <input
                type="text"
                placeholder="örn: admin veya developer"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Şifre (İsteğe Bağlı)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              variant="primary"
              type="submit"
              className="btn-auth-submit"
              disabled={isLoading}
            >
              {isLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap (JWT)'}
            </Button>

            {/* Quick Demo Access */}
            <div className="quick-demo-section">
              <div className="quick-demo-title">
                <span>⚡ Hızlı Demo Girişi (Geliştirici Modu)</span>
              </div>
              <div className="quick-demo-grid">
                <button
                  type="button"
                  className="btn-quick-demo admin"
                  onClick={() => handleQuickDemoClick('user_admin')}
                  disabled={isLoading}
                >
                  <span className="demo-icon">🛡️</span>
                  <div className="demo-text">
                    <strong>Admin</strong>
                    <small>Tam Yetkili</small>
                  </div>
                </button>

                <button
                  type="button"
                  className="btn-quick-demo dev"
                  onClick={() => handleQuickDemoClick('user_dev')}
                  disabled={isLoading}
                >
                  <span className="demo-icon">💻</span>
                  <div className="demo-text">
                    <strong>Developer</strong>
                    <small>İzole Alan</small>
                  </div>
                </button>

                <button
                  type="button"
                  className="btn-quick-demo analyst"
                  onClick={() => handleQuickDemoClick('user_analyst')}
                  disabled={isLoading}
                >
                  <span className="demo-icon">📊</span>
                  <div className="demo-text">
                    <strong>Analyst</strong>
                    <small>Veri Alanı</small>
                  </div>
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="form-group">
              <label>Kullanıcı Adı (Benzersiz)</label>
              <input
                type="text"
                placeholder="örn: emre_kaya"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Ad Soyad / Görünen İsim</label>
              <input
                type="text"
                placeholder="örn: Emre Kaya"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>E-posta Adresi</label>
              <input
                type="email"
                placeholder="emre@artificax.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Şifre Belirleyin</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Rol & İzin Düzeyi</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="user">👤 Standart Kullanıcı (İzole Kiracı Alanı)</option>
                <option value="admin">🛡️ Yönetici (Admin - Tam Sistem Yetkisi)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Avatar / Profil Simgesi</label>
              <div className="avatar-picker">
                {['👤', '🛡️', '💻', '📊', '🚀', '🧪', '⚡', '🤖'].map((av) => (
                  <button
                    key={av}
                    type="button"
                    className={`btn-avatar-pick ${avatar === av ? 'selected' : ''}`}
                    onClick={() => setAvatar(av)}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              type="submit"
              className="btn-auth-submit"
              disabled={isLoading}
            >
              {isLoading ? 'Hesap Oluşturuluyor...' : 'Kiracı Hesabını Başlat'}
            </Button>
          </form>
        )}
      </div>
    </Modal>
  )
}
