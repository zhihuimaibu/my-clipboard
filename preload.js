const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electronAPI', {
    onContent: (callback) => ipcRenderer.on('content', (_event, value) => {
      callback(value)
    }),
    setContent: (payload) => ipcRenderer.invoke('set-content', payload),
    setClear: () => ipcRenderer.send('clear'),
    setReady: () => ipcRenderer.send('ready')
})