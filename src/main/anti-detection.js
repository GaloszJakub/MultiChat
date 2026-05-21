// Injected before page scripts — contextIsolation:false so patches affect page world
;(function () {
  // navigator.webdriver must be absent (undefined), not just false
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true,
      enumerable: false,
    })
    // Also delete it from the prototype chain so 'webdriver' in navigator === false
    delete navigator.__proto__.webdriver
  } catch (e) {}

  // Spoof window.chrome like real Chrome
  if (!window.chrome) {
    window.chrome = {
      runtime: {},
      loadTimes: function () { return {} },
      csi: function () { return {} },
      app: { isInstalled: false },
    }
  }

  // Spoof navigator.plugins (Chrome has PDF viewer by default)
  try {
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ]
        plugins.refresh = () => {}
        plugins.item = (i) => plugins[i]
        plugins.namedItem = (n) => plugins.find(p => p.name === n) || null
        return plugins
      },
      configurable: true,
    })
  } catch (e) {}

  // Remove Electron-specific globals
  delete window.process
  delete window.require
})()

