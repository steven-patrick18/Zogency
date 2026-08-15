'use client'

import { addTaskAttachmentsAction } from '@/modules/tasks/actions'

export function AttachmentForm({ taskId }: { taskId: string }) {
  return (
    <form action={addTaskAttachmentsAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="taskId" value={taskId} />
      <input
        name="attachments"
        type="file"
        multiple
        required
        className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
      />
      <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500">
        Upload
      </button>
    </form>
  )
}
