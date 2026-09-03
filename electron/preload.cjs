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
  savePdfReport: (payload) =>
    ipcRenderer.invoke("shopdesk:savePdfReport", payload),
  openReportsFolder: () => ipcRenderer.invoke("shopdesk:openReportsFolder"),
  print: () => ipcRenderer.invoke("shopdesk:print"),
  startOfficeServer: () => ipcRenderer.invoke("shopdesk:startOfficeServer"),
  getOfficeLanInfo: () => ipcRenderer.invoke("shopdesk:getOfficeLanInfo"),
  probeOfficeServer: (url) => ipcRenderer.invoke("shopdesk:probeOfficeServer", url),
  discoverOfficeServers: () => ipcRenderer.invoke("shopdesk:discoverOfficeServers"),
  getLicenseStatus: () => ipcRenderer.invoke("shopdesk:getLicenseStatus"),
  activateLicense: (licenseKey) =>
    ipcRenderer.invoke("shopdesk:activateLicense", licenseKey),
  refreshLicense: () => ipcRenderer.invoke("shopdesk:refreshLicense"),
});
