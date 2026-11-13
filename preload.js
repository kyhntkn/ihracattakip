const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('masaustu', {
  yedekKaydet: (veri, sonYedege, onerilenAd) => ipcRenderer.invoke('yedek:kaydet', veri, sonYedege, onerilenAd),
  yedekAc: () => ipcRenderer.invoke('yedek:ac'),
  odakla: () => ipcRenderer.send('pencere:odakla'),
  ekKlasorSec: () => ipcRenderer.invoke('ek:klasorSec'),
  ekEkle: (klasor, altKlasor) => ipcRenderer.invoke('ek:ekle', klasor, altKlasor),
  ekAc: (yol) => ipcRenderer.invoke('ek:ac', yol)
});
