// Bridges the renderer (setup.html) to the main process without exposing Node.
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('agent', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (data: unknown) => ipcRenderer.invoke('save-config', data),
})
