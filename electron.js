"use strict";

const { app, dialog, Menu, BrowserWindow } = require('electron')
const _path = require('path')
const isMac = process.platform === 'darwin'

const homeDirectory = require('os').homedir();
const wsroot = process.env.HOME_8BITWORKSHOP || _path.join(homeDirectory, '8bitworkshop');

// call updater
require('update-electron-app')()

// init sentry
require('@sentry/electron').init({ dsn: "https://bf329df3d1b34afa9f5b5e8ecd80ad11@o320878.ingest.sentry.io/1813925" });

function openURL(url) {
  return async () => {
    const { shell } = require('electron')
    await shell.openExternal(url);
  }
}

function createWindow (platform, repo, mainfile) {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    backgroundColor: '#fff',
    webPreferences: {
      preload: _path.join(__dirname, './electron-preload.js'),
      nodeIntegration: false,
      enableRemoteModule: false,
      contextIsolation: false,
      sandbox: false,
    }
  })

  // and load the index.html of the app.
  var qs = 'electron=1&';
  if (platform != null) {
    qs += 'platform=' + platform + '&';
  }
  if (mainfile != null) {
    qs += 'file=' + mainfile + '&'
  }
  qs += 'repo=' + (repo || '/');
  win.loadFile('electron.html', {
    search: qs
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

function openWorkspaceWindow(mainfilepath) {
  var relpath = _path.relative(wsroot, mainfilepath);
  if (relpath.startsWith('.')) {
    dialog.showErrorBox('Error', `Your workspace directory must be directly under "${wsroot}/<platform>/"`);
    return;
  }
  var toks = relpath.split(_path.sep);
  if (toks.length < 3) {
    dialog.showErrorBox('Error', `You must create a directory for your project, e.g. "${toks[0]||'<platform>'}/myproject/"`);
    return;
  }
  if (toks.length > 3) {
    dialog.showErrorBox('Error', `Your main file must be directly under "${wsroot}/<platform>/<project>/"`);
    return;
  }
  var wnd = BrowserWindow.getFocusedWindow();
  if (wnd) wnd.close();
  createWindow(toks[0], toks[0] + '/' + toks[1], toks[2]);
}

function openWorkspaceDialog() {
  dialog.showOpenDialog({
    title: "Open Project",
    defaultPath: wsroot,
    properties: ['openFile', 'promptToCreate'],
    message: "Choose the main source file in your project directory (i.e. ~/8bitworkshop/c64/myproject/main.c)",
  }).then((rtn) => {
    if (!rtn.canceled && rtn.filePaths && rtn.filePaths.length > 0) {
      var path = rtn.filePaths[0];
      if (path) {
        openWorkspaceWindow(path);
      }
    }
  });
}

///

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
        {
          label: 'Open Workspace...',
          click: openWorkspaceDialog,
          accelerator: 'CmdOrCtrl+O',
        },
        // When a file is requested from the recent documents menu, the open-file event of app module will be emitted for it.
        {
          "label":"Open Recent",
          "role":"recentdocuments",
          "submenu":[
            {
              "label":"Clear Recent",
              "role":"clearrecentdocuments"
            }
          ]
        },
        { type: 'separator' },
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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  app.quit()
})

app.on('open-file', (event, path) => {
  openWorkspaceWindow(path);
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(buildMenu).then(createWindow)

