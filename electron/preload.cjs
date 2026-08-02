const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shopdesk", {
  isOfflineApp: true,
  getMode: () => ipcRenderer.invoke("shopdesk:getMode"),
  loadData: () => ipcRenderer.invoke("shopdesk:loadData"),
  saveData: (data) => ipcRenderer.invoke("shopdesk:saveData", data),
  saveDoc: (payload) => ipcRenderer.invoke("shopdesk:saveDoc", payload),
  readDoc: (fileId) => ipcRenderer.invoke("shopdesk:readDoc", fileId),
  deleteDoc: (fileId) => ipcRenderer.invoke("shopdesk:deleteDoc", fileId),
  openDataFolder: () => ipcRenderer.invoke("shopdesk:openDataFolder"),
});
