const { app, dialog, ipcMain, ipcRenderer, Menu, BrowserWindow } = require('electron')
const modpath = require('path')
const fs = require('fs')
const {URLSearchParams} = require('url')
const isMac = process.platform === 'darwin'
const chokidar = require('chokidar')
const Store = require('electron-store');
const store = new Store();
const KEY_lastWorkspaceFilePath = "lastWorkspaceFilePath";

// file watcher
// TODO: add workspace metadata for platform, ROM output, README, etc.
class Workspace {
  constructor(directory, mainfile, wnd) {
    this.directory = directory;
    this.mainfile = mainfile;
    wnd.webContents.send('setWorkspaceRoot', {root:this.directory});
    this.watcher = chokidar.watch(modpath.join(directory, mainfile));
    this.watcher.on('all', (event, path) => {
      console.log(event, path);
      switch (event) {
        case 'add':
        case 'change':
          wnd.webContents.send('fileChanged', {
            path: modpath.relative(this.directory, path),
          });
          break;
      }
    });
    console.log("workspace opened", this.directory, this.mainfile);
  }
  close() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("workspace closed", this.directory, this.mainfile);
    }
  }
}

function openFile(path, wnd) {
  if (!fs.existsSync(path)) {
    dialog.showMessageBox({
      type: "error",
      message: "File not found.",
      detail: path
    });
    return;
  }
  var dirname = modpath.dirname(path);
  var filename = modpath.basename(path);
  if (!wnd) wnd = BrowserWindow.getFocusedWindow();
  var ws = new Workspace(dirname, filename, wnd);
  if (wnd.workspace) { wnd.workspace.close(); }
  wnd.workspace = ws;
  wnd.on('closed', () => {
    ws.close();
  });
  openWorkspace(wnd, ws);
  app.addRecentDocument(path);
  store.set(KEY_lastWorkspaceFilePath, path);
}

function openWorkspace(wnd, ws) {
  var qs = new URLSearchParams();
  qs.set('electron_ws', 1);
  qs.set('repo', ws.directory);
  qs.set('file', ws.mainfile);
  wnd.loadURL(`file://${__dirname}/electron.html?${qs}`).then(() => {
    wnd.webContents.send('setWorkspaceRoot', {root:ws.directory});
  });
}

// TODO: doesn't work if browser window reloads itself
function reloadCurrentWindow() {
  var wnd = BrowserWindow.getFocusedWindow();
  if (wnd.workspace) {
    openWorkspace(wnd, wnd.workspace);
  } else {
    wnd.reload();
  }
}

function openFileDialog() {
  dialog.showOpenDialog({
    title: "Open File",
    properties: ['openFile','promptToCreate'],
  }).then((rtn) => {
    if (!rtn.canceled && rtn.filePaths && rtn.filePaths.length > 0) {
      var path = rtn.filePaths[0];
      openFile(path);
    }
  });
}

function openDefaultFile() {
  var wnd = createWindow();
  if (process.argv.length >= 3) {
    openFile(process.argv[2], wnd);
  }
  /* TODO
  var lastfile = store.get(KEY_lastWorkspaceFilePath);
  if (lastfile != null) {
    openFile(lastfile);
  }
  */
}

/*
function openWorkspace() {
  const { dialog } = require('electron')
  console.log(dialog.showOpenDialog({
    title: "Open Workspace",
    properties: ['openDirectory','createDirectory','promptToCreate'],
    message: "Choose a directory that holds your source files.",
  }))
}
*/

function openURL(url) {
  return async () => {
    const { shell } = require('electron')
    await shell.openExternal(url);
  }
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
        {
          label: 'Open File...',
          click: openFileDialog,
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
          click: openURL('https://8bitworkshop.com/blog/docs/ide.md.html')
        },
        {
          label: 'Latest News',
          click: openURL('https://8bitworkshop.com/blog/')
        },
        {
          label: 'Follow @8bitworkshop on Twitter',
          click: openURL('https://twitter.com/8bitworkshop')
        },
        {
          label: 'Report an Issue',
          click: openURL('https://github.com/sehugg/8bitworkshop/issues/new')
        },
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
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
    search: 'repo=/'
  })

  // Open the DevTools.
  //win.webContents.openDevTools()

  // Maximize
  win.maximize();
  return win;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(buildMenu).then(openDefaultFile)

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
    createWindow()
  }
})

app.on('open-file', (event, path) => {
  openFile(path);
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Register IPC messages
// https://stackoverflow.com/questions/52236641/electron-ipc-and-nodeintegration
/*
ipcMain.on('hello', (event, message) => {
  console.log(event);
});
*/

