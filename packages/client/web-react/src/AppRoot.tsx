import React, { useState } from 'react'
import { AppFrame, Header, WorkspaceModal } from '@custom-harness/client-ui-layout'
import { SidebarRoot } from '@custom-harness/client-ui-sidebar'
import { ConversationTimeline, InputArea } from '@custom-harness/client-ui-conversation'
import { SettingsModal } from '@custom-harness/client-ui-settings'
import { ToastContainer } from './ToastContainer.js'
import { UserQuestionModal } from './UserQuestionModal.js'
import { RagModal } from './RagModal.js'
import { SkillModal } from './SkillModal.js'
import { useAgent } from './AgentContext.js'

export function AppRoot() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [isRagOpen, setIsRagOpen] = useState(false)
  const [isSkillsOpen, setIsSkillsOpen] = useState(false)
  const agent = useAgent()

  const activeModelId = agent.settings.defaultModel || 'gemma-4-abliterated'
  const activePresetName = agent.activePreset?.name || 'Full-Stack Developer'

  const availableModels = [
    'gemma-4-abliterated',
    'Qwen3.8-27B',
    'DeepSeek-V3',
    'Claude-3.5-Sonnet'
  ]

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

  return (
    <>
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
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenWorkspace={() => setIsWorkspaceOpen(true)}
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
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenWorkspace={() => setIsWorkspaceOpen(true)}
            onOpenRag={() => setIsRagOpen(true)}
            onOpenSkills={() => setIsSkillsOpen(true)}
            isConnected={agent.isConnected}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        }
      >
        <div className="conversation-container">
          <ConversationTimeline
            messages={agent.messages}
            isStreaming={agent.isStreaming}
            activePresetName={activePresetName}
            activeModelName={activeModelId}
            pendingApproval={agent.pendingApproval}
            onRespondApproval={agent.respondApproval}
            onQuickAction={(prompt) => agent.sendMessage(prompt)}
          />

          <div className="conversation-bottom-pane">
            <InputArea
              onSendMessage={agent.sendMessage}
              onStop={agent.stopStreaming}
              isStreaming={agent.isStreaming}
              disabled={false}
              tokenInfo={{
                usedTokens,
                maxTokens,
                pct: tokenPct
              }}
            />
          </div>
        </div>
      </AppFrame>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={agent.settings}
        presets={agent.presets}
        activePresetId={agent.activePreset?.id || 'full-stack'}
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
        isOpen={isRagOpen}
        onClose={() => setIsRagOpen(false)}
        onShowToast={agent.showToast}
      />

      <SkillModal
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
        onShowToast={agent.showToast}
      />

      <UserQuestionModal
        questionRequest={agent.pendingQuestion}
        onRespond={agent.respondQuestion}
      />

      <ToastContainer toasts={agent.toasts} />
    </>
  )
}
