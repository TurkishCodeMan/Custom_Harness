import React, { useState } from 'react'
import { AppFrame, Header, WorkspaceModal } from '@custom-harness/client-ui-layout'
import { SidebarRoot } from '@custom-harness/client-ui-sidebar'
import { ConversationTimeline, InputArea } from '@custom-harness/client-ui-conversation'
import { SettingsModal } from '@custom-harness/client-ui-settings'
import { AdminPanelModal } from '@custom-harness/client-ui-admin'
import { AuthModal } from '@custom-harness/client-ui-auth'
import { ToastContainer } from './ToastContainer.js'
import { UserQuestionModal } from './UserQuestionModal.js'
import { RagModal } from './RagModal.js'
import { SkillModal } from './SkillModal.js'
import { MyFilesModal } from './MyFilesModal.js'
import { useAgent } from './AgentContext.js'

export function AppRoot() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [isRagOpen, setIsRagOpen] = useState(false)
  const [isSkillsOpen, setIsSkillsOpen] = useState(false)
  const [isMyFilesOpen, setIsMyFilesOpen] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const agent = useAgent()

  const activeModelId = agent.settings.defaultModel || 'gemma-4-abliterated'
  const activePresetName = agent.activePreset?.name || 'Full-Stack Developer'

  const availableModels = React.useMemo(() => {
    const list: string[] = []
    if (agent.settings?.providers) {
      for (const p of Object.values<any>(agent.settings.providers)) {
        if (Array.isArray(p.models)) {
          for (const m of p.models) {
            if (m.id && !list.includes(m.id)) list.push(m.id)
          }
        }
      }
    }
    if (list.length === 0) {
      return ['gemma-4-abliterated', 'Qwen3.8-27B', 'DeepSeek-V3', 'Claude-3.5-Sonnet']
    }
    return list
  }, [agent.settings])

  const availablePresets = (agent.presets && agent.presets.length > 0)
    ? agent.presets.map((p: any) => p.name)
    : ['Full-Stack Developer', 'Architect & Planner', 'Bug Hunter & QA', 'Code Reviewer']

  // Token calculations for pill
  const usedTokens = agent.tokenMeasurement
    ? (agent.tokenMeasurement.totalTokens ?? (agent.tokenMeasurement as any).totalTokensUsed ?? 0)
    : 0
  const maxTokens = agent.tokenMeasurement
    ? (agent.tokenMeasurement.contextWindowSize ?? 32768)
    : 32768
  const tokenPct = maxTokens > 0 ? Math.round((usedTokens / maxTokens) * 100) : 0

  const isMustAuth = !agent.currentUser

  return (
    <>
      {isMustAuth ? (
        <div className="auth-gate-screen">
          <div className="auth-gate-background-glow" />
          <AuthModal
            isOpen={true}
            isClosable={false}
            onClose={() => {}}
            onLogin={agent.login}
            onRegister={agent.register}
            onQuickLogin={agent.switchUser}
            availableDemoUsers={agent.users}
            onShowToast={agent.showToast}
          />
        </div>
      ) : (
        <AppFrame
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          sidebar={
            isSidebarOpen ? (
              <SidebarRoot
                sessions={agent.sessions}
                activeSessionId={agent.activeSessionId}
                onSelectSession={agent.selectSession}
                onNewSession={agent.createNewSession}
                onDeleteSession={(id) => agent.deleteSession(id)}
                onRenameSession={(id, title) => agent.renameSession(id, title)}
                onClearAllSessions={agent.clearAllSessions}
                activeModelName={activeModelId}
                workspace={agent.workspace}
                sandboxMode={agent.sandboxMode}
                onSelectSandboxMode={agent.setSandboxMode}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenWorkspace={() => setIsWorkspaceOpen(true)}
                onOpenSkills={() => setIsSkillsOpen(true)}
                onOpenRag={() => setIsRagOpen(true)}
              />
            ) : null
          }
          header={
            <Header
              workspace={agent.workspace}
              activeModelName={activeModelId}
              activePresetName={activePresetName}
              availableModels={availableModels}
              onSelectModel={agent.selectModel}
              availablePresets={availablePresets}
              onSelectPreset={agent.selectPreset}
              currentUser={agent.currentUser}
              users={agent.users}
              onSwitchUser={agent.switchUser}
              onOpenAdmin={() => setIsAdminOpen(true)}
              onOpenAuth={() => setIsAuthOpen(true)}
              onLogout={agent.logout}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenWorkspace={() => setIsWorkspaceOpen(true)}
              isConnected={agent.isConnected}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
              sandboxMode={agent.sandboxMode}
              onSelectSandboxMode={agent.setSandboxMode}
            />
          }
        >
          <div className={`conversation-container ui-font-${agent.settings?.ui?.fontSize || 'md'} ui-weight-${agent.settings?.ui?.fontWeight || 'semibold'} ui-bubble-${agent.settings?.ui?.bubbleStyle || 'modern'}`}>
            <ConversationTimeline
              messages={agent.messages}
              isStreaming={agent.isStreaming}
              activePresetName={activePresetName}
              activeModelName={activeModelId}
              pendingApproval={agent.pendingApproval}
              onRespondApproval={agent.respondApproval}
              onQuickAction={(prompt) => agent.sendMessage(prompt)}
              onDropFiles={agent.uploadFiles}
            />

            <div className="conversation-bottom-pane">
              <InputArea
                onSendMessage={agent.sendMessage}
                onStop={agent.stopStreaming}
                isStreaming={agent.isStreaming}
                disabled={false}
                attachments={agent.attachments}
                onUploadFiles={agent.uploadFiles}
                onRemoveAttachment={agent.removeAttachment}
                isUploading={agent.isUploading}
                onOpenMyFiles={() => setIsMyFilesOpen(true)}
                onOpenRag={() => setIsRagOpen(true)}
                onOpenSkills={() => setIsSkillsOpen(true)}
                onOpenWorkspace={() => setIsWorkspaceOpen(true)}
                onClearChat={agent.clearMessages}
                tokenInfo={{
                  usedTokens,
                  maxTokens,
                  pct: tokenPct
                }}
              />
            </div>
          </div>
        </AppFrame>
      )}

      {/* Standalone Auth Modal when opened by user while logged in */}
      {!isMustAuth && (
        <AuthModal
          isOpen={isAuthOpen}
          isClosable={true}
          onClose={() => setIsAuthOpen(false)}
          onLogin={agent.login}
          onRegister={agent.register}
          onQuickLogin={agent.switchUser}
          availableDemoUsers={agent.users}
          onShowToast={agent.showToast}
        />
      )}

      <AdminPanelModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        currentUser={agent.currentUser}
        users={agent.users}
        onSwitchUser={agent.switchUser}
        onCreateUser={agent.createUser}
        onUpdateUserRole={agent.updateUserRole}
        onDeleteUser={agent.deleteUser}
        onShowToast={agent.showToast}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={agent.settings}
        presets={agent.presets}
        activePresetId={agent.activePreset?.id || 'full-stack'}
        isAdmin={agent.currentUser?.role === 'admin'}
        onSaveSettings={agent.saveSettings}
        onSavePreset={agent.savePreset}
        onSetDefaultPreset={agent.setDefaultPreset}
        onTogglePlugin={agent.togglePlugin}
      />

      <WorkspaceModal
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        currentWorkspace={agent.workspace}
        onSelectWorkspace={agent.setWorkspace}
      />

      <RagModal
        key={`rag-${agent.currentUser?.id || 'guest'}`}
        isOpen={isRagOpen}
        onClose={() => setIsRagOpen(false)}
        onShowToast={agent.showToast}
        currentUser={agent.currentUser}
        users={agent.users}
      />

      <SkillModal
        key={`skill-${agent.currentUser?.id || 'guest'}`}
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
        onShowToast={agent.showToast}
        currentUser={agent.currentUser}
        users={agent.users}
      />

      <MyFilesModal
        key={`files-${agent.currentUser?.id || 'guest'}`}
        isOpen={isMyFilesOpen}
        onClose={() => setIsMyFilesOpen(false)}
        onAttachFile={agent.attachFile}
        onShowToast={agent.showToast}
        currentUser={agent.currentUser}
        onUploadFiles={agent.uploadFiles}
      />

      <UserQuestionModal
        questionRequest={agent.pendingQuestion}
        onRespond={agent.respondQuestion}
      />

      <ToastContainer toasts={agent.toasts} />
    </>
  )
}
