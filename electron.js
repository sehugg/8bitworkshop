const { app, ipcMain, ipcRenderer, Menu, BrowserWindow } = require('electron')
const modpath = require('path')
const fs = require('fs')
const {URLSearchParams} = require('url')
const isMac = process.platform === 'darwin'
const chokidar = require('chokidar')

// file watcher
class Workspace {
  constructor(directory, mainfile, wnd) {
    this.directory = directory;
    this.mainfile = mainfile;
    this.watcher = chokidar.watch(modpath.join(directory, mainfile));
    this.watcher.on('all', (event, path) => {
      console.log(event, path);
      switch (event) {
        case 'add':
          /*
          wnd.webContents.send('updateFile', {
            main: modpath.relative(mainDirectoryPath, mainFilePath),
            path: modpath.relative(mainDirectoryPath, path),
            data: data,
          });
          */
          break;
      }
    });
  }
}

function openFile(path) {
  var data = new Uint8Array(fs.readFileSync(path));
  var dirname = modpath.dirname(path);
  var filename = modpath.basename(path);
  //var platform_id = 'vcs'; // TODO: which platform?
  //var wnd = createWindow({repo_id:dirname, file:filename, platform_id:platform_id});
  var wnd = BrowserWindow.getFocusedWindow();
  var ws = new Workspace(dirname, filename, wnd);
  wnd.workspace = ws;
  var qs = new URLSearchParams();
  qs.set('ws', dirname);
  qs.set('file', filename);
  wnd.loadURL(`file://${__dirname}/electron.html?${qs}`);
}

function openFileDialog() {
  const { dialog } = require('electron')
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

function openWorkspace() {
  const { dialog } = require('electron')
  console.log(dialog.showOpenDialog({
    title: "Open Workspace",
    properties: ['openDirectory','createDirectory','promptToCreate'],
    message: "Choose a directory that holds your source files.",
  }))
}

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
        /*
        {
          label: 'Open File...',
          click: openFileDialog,
          accelerator: 'CmdOrCtrl+O',
        },
        */
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
        { role: 'reload' },
        { role: 'forcereload' },
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
      contextIsolation: true,
      sandbox: true,
    }
  })

  // and load the index.html of the app.
  win.loadFile('electron.html')

  // Open the DevTools.
  //win.webContents.openDevTools()

  // Maximize
  win.maximize();
  return win;
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
    createWindow()
  }
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
