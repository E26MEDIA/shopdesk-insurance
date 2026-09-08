const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shopdesk", {
  isOfflineApp: true,
  getMode: () => ipcRenderer.invoke("shopdesk:getMode"),
  loadData: () => ipcRenderer.invoke("shopdesk:loadData"),
  saveData: (data) => ipcRenderer.invoke("shopdesk:saveData", data),
  saveDoc: (payload) => ipcRenderer.invoke("shopdesk:saveDoc", payload),
  readDoc: (fileId) => ipcRenderer.invoke("shopdesk:readDoc", fileId),
  deleteDoc: (fileId) => ipcRenderer.invoke("shopdesk:deleteDoc", fileId),
  recoverDocuments: (data) => ipcRenderer.invoke("shopdesk:recoverDocuments", data),
  listDocs: () => ipcRenderer.invoke("shopdesk:listDocs"),
  docStat: (fileId) => ipcRenderer.invoke("shopdesk:docStat", fileId),
  openDataFolder: () => ipcRenderer.invoke("shopdesk:openDataFolder"),
  savePdfReport: (payload) =>
    ipcRenderer.invoke("shopdesk:savePdfReport", payload),
  saveExcelReport: (payload) =>
    ipcRenderer.invoke("shopdesk:saveExcelReport", payload),
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
  checkForUpdate: () => ipcRenderer.invoke("shopdesk:checkForUpdate"),
  downloadUpdate: () => ipcRenderer.invoke("shopdesk:downloadUpdate"),
  getUpdateDownloadState: () => ipcRenderer.invoke("shopdesk:getUpdateDownloadState"),
  installUpdate: () => ipcRenderer.invoke("shopdesk:installUpdate"),
  onUpdateProgress: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("shopdesk:update-progress", listener);
    return () => ipcRenderer.removeListener("shopdesk:update-progress", listener);
  },
  openExternal: (url) => ipcRenderer.invoke("shopdesk:openExternal", url),
});
