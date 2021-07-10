"use strict";

const { app, Menu, BrowserWindow } = require('electron')
const modpath = require('path')
const isMac = process.platform === 'darwin'

// call updater
///require('update-electron-app')()

// init sentry
require('@sentry/electron').init({ dsn: "https://bf329df3d1b34afa9f5b5e8ecd80ad11@o320878.ingest.sentry.io/1813925" });

function openURL(url) {
  return async () => {
    const { shell } = require('electron')
    await shell.openExternal(url);
  }
}

function createWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    backgroundColor: '#fff',
    webPreferences: {
      preload: modpath.join(__dirname, './electron-preload.js'),
      nodeIntegration: false,
      enableRemoteModule: false,
      contextIsolation: false,
      sandbox: false,
    }
  })

  // and load the index.html of the app.
  win.loadFile('electron.html', {
    search: 'electron=1&repo=/'
  });

  // Maximize
  win.maximize();
  return win;
}

// TODO: doesn't work if browser window reloads itself
function reloadCurrentWindow() {
  var wnd = BrowserWindow.getFocusedWindow();
  wnd.reload();
}

function buildMenu() {

  const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startspeaking' },
              { role: 'stopspeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Window',
          click: reloadCurrentWindow
        },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'IDE Help',
          click: openURL('https://8bitworkshop.com/docs/docs/ide.html')
        },
        {
          label: 'Latest News',
          click: openURL('https://8bitworkshop.com/docs/blog.html')
        },
        {
          label: 'Report an Issue',
          click: openURL('https://github.com/sehugg/8bitworkshop/issues/new')
        },
        { type: 'separator' },
        {
          label: 'Follow @8bitworkshop on Twitter',
          click: openURL('https://twitter.com/8bitworkshop')
        },
        {
          label: 'Become a Patreon',
          click: openURL('https://www.patreon.com/8bitworkshop')
        },
        {
          label: 'Buy 8bitworkshop Books',
          click: openURL('https://www.amazon.com/s?k=8bitworkshop&i=stripbooks&dc&qid=1598884483&tag=pzp-20')
        },
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(buildMenu).then(createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    openDefaultWorkspace()
  }
})

/* TODO
app.on('browser-window-focus', (e) => {
  var ws = e.sender.workspace;
  if (ws) ws.unwatch();
})

app.on('browser-window-blur', (e) => {
  var ws = e.sender.workspace;
  if (ws) ws.watch(e.sender);
})
*/
