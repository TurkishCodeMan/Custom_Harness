import { Router, type RequestHandler } from 'express'
import type { Context } from '@custom-harness/core-context'

export function createSkillsRouter(ctx: Context): Router {
  const router = Router()

  // Middleware: Ensures skills service is loaded
  const requireSkillsService: RequestHandler = (req: any, res, next) => {
    const skills = ctx.skills
    if (!skills) return res.status(503).json({ error: 'Skills service not loaded' })
    req.skills = skills
    next()
  }

  router.use(requireSkillsService)

  // 1. List Skills
  router.get('/skills', (req: any, res) => {
    try {
      const caller = req.user!
      const skills = req.skills
      const list = skills.listSkills(caller.id, caller.role === 'admin').map((s: any) => {
        const rawInfo = skills.getSkillRaw(s.id)
        return {
          ...s,
          rawContent: rawInfo?.raw || `---
name: ${s.name}
description: ${s.description}
---

${s.content}`
        }
      })
      res.json({
        skills: list,
        template: skills.getDefaultTemplate()
      })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 2. Template
  router.get('/skills/template', (req: any, res) => {
    try {
      const skills = req.skills
      const name = (req.query.name as string) || 'yeni-beceri'
      const desc = (req.query.description as string) || 'Bu becerinin ne yaptığı ve ne zaman kullanılacağı'
      const tpl = skills.getDefaultTemplate(name, desc)
      res.json({ template: tpl })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // 3. Create Skill
  router.post('/skills', (req: any, res) => {
    try {
      const caller = req.user!
      const skills = req.skills
      const { id, name, description, content, rawContent, isGlobal, enabled } = req.body

      let skillName = (name || '').trim()
      let skillDescription = (description || '').trim()

      if (rawContent && rawContent.startsWith('---')) {
        const matchName = rawContent.match(/^name:\s*(.+)$/m)
        if (matchName && matchName[1]) skillName = matchName[1].trim().replace(/^['"]|['"]$/g, '')
        const matchDesc = rawContent.match(/^description:\s*(.+)$/m)
        if (matchDesc && matchDesc[1]) skillDescription = matchDesc[1].trim().replace(/^['"]|['"]$/g, '')
      }

      const rawId = (id && id !== 'yeni-uzmanlik' && id !== 'custom-skill') 
        ? id 
        : (skillName || id || 'custom-skill')

      const skillId = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      if (!skillId) return res.status(400).json({ error: 'Geçerli bir beceri adı/ID zorunludur' })

      const ws = (req.query.workspace as string) || ctx.settings.getWorkspace()
      const created = skills.createSkill({
        id: skillId,
        name: skillName || skillId,
        description: skillDescription,
        content,
        rawContent,
        isGlobal: Boolean(isGlobal && caller.role === 'admin'),
        workspaceDir: ws,
        userId: caller.id,
        isAdmin: caller.role === 'admin',
        enabled: enabled !== undefined ? Boolean(enabled) : true
      })
      res.json({ success: true, skill: created })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 4. Update Skill
  router.put('/skills/:id', (req: any, res) => {
    try {
      const caller = req.user!
      const skills = req.skills
      const { name, description, content, rawContent, enabled } = req.body
      const ws = (req.query.workspace as string) || ctx.settings.getWorkspace()
      const updated = skills.updateSkill(req.params.id, {
        name,
        description,
        content,
        rawContent,
        workspaceDir: ws,
        userId: caller.id,
        isAdmin: caller.role === 'admin',
        enabled: enabled !== undefined ? Boolean(enabled) : undefined
      })
      res.json({ success: true, skill: updated })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 5. Toggle Skill
  router.post('/skills/:id/toggle', (req: any, res) => {
    try {
      const caller = req.user!
      const skills = req.skills
      const { enabled } = req.body
      const isEnabled = enabled !== undefined ? Boolean(enabled) : true
      const updated = skills.toggleSkill(req.params.id, isEnabled, caller.id, caller.role === 'admin')
      res.json({ success: true, skill: updated })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 6. Delete Skill
  router.delete('/skills/:id', (req: any, res) => {
    try {
      const caller = req.user!
      const skills = req.skills
      skills.deleteSkill(req.params.id, caller.id, caller.role === 'admin')
      res.json({ success: true })
    } catch (e: any) {
      res.status(400).json({ error: e.message })
    }
  })

  // 7. Update Permissions
  router.post('/skills/permissions', (req: any, res) => {
    try {
      const caller = req.user!
      const skills = req.skills
      const { skillId, allowedUserIds, isPublic } = req.body
      if (!skillId) return res.status(400).json({ error: 'Beceri ID (skillId) zorunludur' })
      const updated = skills.updateSkillPermissions(
        skillId,
        Array.isArray(allowedUserIds) ? allowedUserIds : ['*'],
        isPublic !== false,
        caller.id,
        caller.role === 'admin'
      )
      res.json({ success: true, skill: updated })
    } catch (e: any) {
      res.status(403).json({ error: e.message })
    }
  })

  return router
}
