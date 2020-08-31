const { app, dialog, ipcMain, ipcRenderer, Menu, BrowserWindow } = require('electron')
const modpath = require('path')
const fs = require('fs')
const {URLSearchParams} = require('url')
const isMac = process.platform === 'darwin'
const chokidar = require('chokidar')
const Store = require('electron-store');
const store = new Store();
const WSMETA_FILENAME = "8bitworkshop.json"
const README_FILENAME = "README.md"

// call updater
require('update-electron-app')()

// show error dialog
function showError(msg, detail) {
  msg = msg.message || msg;
  dialog.showMessageBoxSync({
    type: "error",
    message: msg,
    detail: detail
  });
}

// file watcher
class Workspace {
  constructor(directory, meta) {
    this.directory = directory;
    this.mainfile = meta.mainfile;
    this.platform = meta.platform;
    if (!this.mainfile) throw new Error(`The "mainfile" key is missing in ${WSMETA_FILENAME}.`)
    if (!this.platform) throw new Error(`The "platform" key is missing in ${WSMETA_FILENAME}.`)
    var mainfilepath = this.getMainFilePath();
    if (!fs.existsSync(mainfilepath)) throw new Error(`The file "${mainfilepath}" is missing.`);
    console.log("workspace opened", this.directory, this.mainfile);
  }
  getMainFilePath() {
    return modpath.join(this.directory, this.mainfile);
  }
  close() {
    this.unwatch();
    console.log("workspace closed", this.directory, this.mainfile);
  }
  watch(wnd) {
    this.watcher = chokidar.watch(this.directory, {
      awaitWriteFinish: false
    });
    this.watcher.on('all', (event, path) => {
      switch (event) {
        case 'change':
          console.log(event, path);
          wnd.webContents.send('fileChanged', {
            path: modpath.relative(this.directory, path),
          });
          break;
      }
    });
    console.log("watching workspace");
  }
  unwatch() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log("un-watching workspace");
    }
  }
}

function readWorkspaceMetadata(directory) {
  // check README file
  var readmepath = modpath.join(directory, README_FILENAME);
  if (fs.existsSync(readmepath)) {
    let readme = fs.readFileSync(readmepath, 'utf8');
    let sess = {};
    // check README for main file
    const re8main = /8bitworkshop.com[^)]+file=([^)&]+)/;
    m = re8main.exec(readme);
    if (m && m[1]) {
      sess.mainfile = m[1];
    }
    // check README for proper platform
    // unless we use githubURL=
    const re8plat = /8bitworkshop.com[^)]+platform=([A-Za-z0-9._\-]+)/;
    m = re8plat.exec(readme);
    if (m) {
      sess.platform = m[1];
    }
    if (sess.mainfile != null && sess.platform != null) return sess;
  }
  // check JSON file
  var metapath = modpath.join(directory, WSMETA_FILENAME);
  if (fs.existsSync(metapath)) {
    return JSON.parse(fs.readFileSync(metapath, 'utf8'));
  }
}

function writeWorkspaceMetadata(directory, meta) {
  var metapath = modpath.join(directory, WSMETA_FILENAME);
  fs.writeFileSync(metapath, JSON.stringify(meta), 'utf8');
}

function openWorkspace(wnd, ws) {
  if (wnd.workspace) { wnd.workspace.close(); }
  wnd.workspace = ws;
  wnd.on('closed', () => {
    ws.close();
  });
  var qs = new URLSearchParams();
  qs.set('electron_ws', 1);
  qs.set('repo', ws.directory);
  qs.set('file', ws.mainfile);
  qs.set('platform', ws.platform);
  console.log(qs);
  wnd.loadURL(`file://${__dirname}/electron.html?${qs}`).then(() => {
    wnd.webContents.send('setWorkspaceRoot', {root:ws.directory});
  });
}

function getActiveWorkspace() {
  var wnd = BrowserWindow.getFocusedWindow();
  return wnd && wnd.workspace;
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

// TODO: better way to get this?
function getCurrentPlatform(wnd) {
  var url = wnd.webContents.getURL();
  if (url != null) {
    console.log(url);
    var m = /platform=([^&]+)/.exec(url);
    if (m) return m[1];
  }
}

function openWorkspaceWindow(wspath) {
  try {
    // replace current window
    var wnd = BrowserWindow.getFocusedWindow() || createWindow();
    // read metadata file
    var meta = readWorkspaceMetadata(wspath);
    // does it exist?
    if (meta == null) {
      // create a new workspace?
      var cancel = dialog.showMessageBoxSync(wnd, {
        type: 'question',
        title: 'Create Workspace?',
        message: `Project metadata not found. Create new ${getCurrentPlatform(wnd)||""} project in this directory?`,
        detail: wspath,
        buttons: ['Create', 'Cancel'],
      });
      if (!cancel) {
        var platform = getCurrentPlatform(wnd);
        // choose main file
        var files = dialog.showOpenDialogSync({
          message: `Choose the main file of your ${platform} project, or create one.`,
          defaultPath: wspath,
          properties: ['openFile','promptToCreate'],
        });
        if (files != null) {
          var mainfile = modpath.relative(wspath, files[0]);
          // write new metadata
          meta = {
            platform: platform,
            mainfile: mainfile,
          };
          console.log(meta);
          if (meta.platform == null) {
            showError("Can't determine current platform.");
          } else {
            writeWorkspaceMetadata(wspath, meta);
            openWorkspaceWindow(wspath);
          }
        }
      }
    } else {
      console.log(meta);
      var ws = new Workspace(wspath, meta);
      openWorkspace(wnd, ws);
      app.addRecentDocument(wspath);
    }
  } catch (e) {
    showError(e);
  }
}

function openDefaultWorkspace() {
  if (process.argv.length >= 3) {
    openWorkspaceWindow(modpath.resolve(process.argv[2]));
  } else {
    createWindow();
  }
}

function openWorkspaceDialog() {
  dialog.showOpenDialog({
    title: "Open Workspace",
    properties: ['openDirectory'],
    message: "Choose the directory that holds your source files.",
  }).then((rtn) => {
    if (!rtn.canceled && rtn.filePaths && rtn.filePaths.length > 0) {
      var path = rtn.filePaths[0];
      openWorkspaceWindow(path);
    }
  });
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
        {
          label: 'New Playground',
          click: createWindow,
          accelerator: 'CmdOrCtrl+N',
        },
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
          click: openURL('https://8bitworkshop.com/blog/docs/ide.md.html')
        },
        {
          label: 'Latest News',
          click: openURL('https://8bitworkshop.com/blog/')
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
          label: 'Browse Books on Amazon',
          click: openURL('https://www.amazon.com/s?k=8bitworkshop&i=stripbooks&dc&qid=1598884483&tag=pzp-20')
        },
        {
          label: 'Become a Patreon',
          click: openURL('https://www.patreon.com/8bitworkshop')
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
app.whenReady().then(buildMenu).then(openDefaultWorkspace)

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

app.on('browser-window-focus', (e) => {
  var ws = e.sender.workspace;
  if (ws) ws.unwatch();
})

app.on('browser-window-blur', (e) => {
  var ws = e.sender.workspace;
  if (ws) ws.watch(e.sender);
})

app.on('open-file', (event, path) => {
  openWorkspaceWindow(path);
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

