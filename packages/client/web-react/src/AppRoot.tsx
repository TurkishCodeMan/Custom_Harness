import React, { useState } from 'react'
import { AppFrame, Header, WorkspaceModal } from '@custom-harness/client-ui-layout'
import { SidebarRoot } from '@custom-harness/client-ui-sidebar'
import { ConversationTimeline, InputArea } from '@custom-harness/client-ui-conversation'
import { TokenMeterBar } from '@custom-harness/client-ui-token-meter'
import { SettingsModal } from '@custom-harness/client-ui-settings'
import { ToastContainer } from './ToastContainer.js'
import { UserQuestionModal } from './UserQuestionModal.js'
import { useAgent } from './AgentContext.js'

export function AppRoot() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const agent = useAgent()

  const activeModelId = agent.settings.defaultModel || 'Custom LLM'
  const activePresetName = agent.activePreset?.name || 'Full-Stack Developer'

  return (
    <>
      <AppFrame
        sidebar={
          <SidebarRoot
            sessions={agent.sessions}
            activeSessionId={agent.activeSessionId}
            onSelectSession={agent.selectSession}
            onNewSession={agent.createNewSession}
            onDeleteSession={(id) => agent.deleteSession(id)}
          />
        }
        header={
          <Header
            workspace={agent.workspace}
            activeModelName={activeModelId}
            activePresetName={activePresetName}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenWorkspace={() => setIsWorkspaceOpen(true)}
            isConnected={agent.isConnected}
          />
        }
      >
        <div className="conversation-container">
          <ConversationTimeline
            messages={agent.messages}
            isStreaming={agent.isStreaming}
            activePresetName={activePresetName}
            pendingApproval={agent.pendingApproval}
            onRespondApproval={agent.respondApproval}
          />

          <div className="conversation-bottom-pane">
            <TokenMeterBar
              measurement={agent.tokenMeasurement}
              modelName={activeModelId}
            />
            <InputArea
              onSendMessage={agent.sendMessage}
              onStop={agent.stopStreaming}
              isStreaming={agent.isStreaming}
              disabled={false}
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

      <UserQuestionModal
        questionRequest={agent.pendingQuestion}
        onRespond={agent.respondQuestion}
      />

      <ToastContainer toasts={agent.toasts} />
    </>
  )
}
