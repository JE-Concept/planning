import { useState } from 'react'
import { PRIORITIES } from '@lib/format'
import { prioSleutel } from '@lib/task-view'
import { Button, Field, Input, Modal, Select, Spinner } from '@ui/index'
import { useTaal } from '@context/TaalProvider'
import { useToast } from '@context/ToastProvider'
import { useWorkspace } from '@context/WorkspaceProvider'
import { createTask } from '@data/tasks'

/**
 * Een nieuwe taak in een lijst.
 *
 * Stond in de bordpagina en wordt nu ook vanaf Tasks geopend. Twee kopieën van
 * hetzelfde formulier is twee plekken waar een veld vergeten wordt toe te voegen,
 * dus staat het hier.
 */
export default function NewTaskDialog({ list, statuses, initialStatus, uid, onClose, onCreated }) {
  const toast = useToast()
  const { t } = useTaal()
  const { profiles } = useWorkspace()
  const [title, setTitle] = useState('')
  const [statusId, setStatusId] = useState(initialStatus?.id ?? statuses[0]?.id ?? '')
  const [assignee, setAssignee] = useState(uid ?? '')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const id = await createTask({
        list,
        status: statuses.find((s) => s.id === statusId) ?? null,
        title,
        assignees: assignee ? [assignee] : [],
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority ? Number(priority) : null,
        createdBy: uid,
      })
      onCreated(id)
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('bord.nieuwe_taak_in', { lijst: list.name })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('alg.annuleren')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!title.trim() || saving}>
            {saving ? <Spinner className="h-3 w-3" /> : null} {t('alg.aanmaken')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('bord.veld.titel')} className="sm:col-span-2">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('bord.wat_moet_gebeuren')} />
        </Field>
        <Field label={t('bord.veld.status')}>
          <Select value={statusId} onChange={(e) => setStatusId(e.target.value)}>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('bord.veld.toewijzen')}>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">{t('alg.niemand')}</option>
            {profiles.filter((p) => p.active !== false).map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName || p.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('bord.veld.deadline')}>
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label={t('bord.veld.prioriteit')}>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">{t('alg.geen')}</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {t(prioSleutel(p.value))}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  )
}
