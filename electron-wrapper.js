const {app, Menu, BrowserWindow, ipcMain, dialog } = require('electron')

const path = require('path')
const fs = require('fs')
// To check for update on Github repo
const {autoUpdater} = require("electron-updater")

// Enable non contribution mode (test)
process.env.SA_MODE = 'gitDisable'
process.env.PACKAGED_PATH = app.getAppPath()
process.env.DATA_PATH = app.getPath('documents')

const WINDOW_WIDTH = 1580
const WINDOW_HEIGHT = 768

let mainWindow, consoleWindow, selectWindow, platform

const port = 34248 // Default HTTP port

// Check if it's the first time you run this app
function firstRun() {
  const configPath = path.join(process.env.DATA_PATH, '/Superalgos_Data/FirstRun');

  if (fs.existsSync(configPath)) {
    return false;
  }

  try {
    fs.writeFileSync(configPath, '');
  } catch (error) {
    if (error.code === 'ENOENT') {
      fs.mkdirSync(path.join(process.env.DATA_PATH, '/Superalgos_Data/'), {recursive: true});
      return firstRun();
    }

    throw error;
  }

  return true;
};

// iterate in the workspaces folder and get all *Onboarding ones to present in the selection page
function getWorkspaces() {
  const workspacePath = path.join(process.env.PACKAGED_PATH, 'Projects/Foundations/Plugins/Workspaces')
  const workspaces = []
  try {
    const files = fs.readdirSync(workspacePath)
    for(const file of files) {
      if (file.includes('-Onboarding-')) {
        workspaces.push(file)
      }
    }
  } catch (error) {
    if (error) {
      console.log(error)
    }
  }
  return workspaces
}

// Create a selection window for first run
function selectionWindow() {
  let bw_options = {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: true,
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.join(__dirname, "preload.js") // use a preload script
    }
  }
  selectWindow = new BrowserWindow(
    bw_options
  )
  selectWindow.loadFile('./selection.html')
}

function run(workspace) {
  const { fork } = require('child_process')
  platform = fork(path.join(__dirname, '/PlatformRoot.js'), ["noBrowser"], {stdio: ['pipe', 'pipe', 'pipe', 'ipc'], env: process.env})

  platform.on('message', _ => {
    openMain(workspace)
    openConsoleWindow()
    if (selectWindow) {selectWindow.close()}
  })
}

ipcMain.on("toMain", (event, args) => {
  if (args === "ImAlive!" && consoleWindow) {
    platform.stdout.setEncoding('utf8')
    platform.stdout.on('data', (data) => {
      consoleWindow.webContents.send("fromMain", data);
    })
  } else if (args === "getExchanges") {
    const workspaces = getWorkspaces()
    selectWindow.webContents.send("fromMain", workspaces); //send to the renderer
  } else if (args.includes(".json")) {
    var workspace = args.split('.')[0]
    run(workspace)
  }
})

function openMain(workspace) {
  let bw_options = {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: true,
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.join(__dirname, "preload.js") // use a preload script
    }
  }

  mainWindow = new BrowserWindow(
    bw_options
  )

  createMainMenus()
  
  if (workspace) {
    var queryString = '/?initialWorkspaceName=' + workspace + '&initialWorkspaceProject=Foundations&initialWorkspaceType=Plugin'
    mainWindow.loadURL("http://localhost:" + port + queryString)
  } else {
    mainWindow.loadURL("http://localhost:" + port)
  }


  mainWindow.on('close', function (e) {
    if (consoleWindow.isVisible()) {
      e.preventDefault()
      mainWindow.hide()
    } else {
    let choice = dialog.showMessageBoxSync(
      mainWindow,
      {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm',
        message: 'Do you really want to close Superalgos?'
      }
    )
      // 0 for Yes
      if (choice === 0) {
        mainWindow = null
        app.exit()
      }
      // 1 for No
      if (choice === 1) {
        e.preventDefault()
      } 
    }    
  })

  mainWindow.on('activate', function () {
    mainWindow.show()
  })

  mainWindow.on('focus', function () {
    createMainMenus()
  })
}

function openConsoleWindow() {
  if(consoleWindow) {
    consoleWindow.focus()
    return
  }

  consoleWindow = new BrowserWindow({
    resizable: true,
    title: 'Platform Logs',
    minimizable: false,
    fullscreenable: true,
    show: false,
    width: WINDOW_WIDTH,
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.join(__dirname, "preload.js") // use a preload script
    }
  })

  consoleWindow.setBackgroundColor('#000000')
  consoleWindow.loadFile('./console.html')

  consoleWindow.on('close', function (e) {
    if (mainWindow.isVisible()) {
      e.preventDefault()
      createMainMenus()
      consoleWindow.hide()
    } else {
    let choice = dialog.showMessageBoxSync(
      mainWindow,
      {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm',
        message: 'Do you really want to close Superalgos?'
      }
    )
      // 0 for Yes
      if (choice === 0) {
        consoleWindow = null
        app.exit()
      }
      // 1 for No
      if (choice === 1) {
        e.preventDefault()
      } 
    }    
  })

  consoleWindow.on('focus', function () {
    createConsoleMenus()
  })
}

app.on('ready', function () {
  autoUpdater.checkForUpdatesAndNotify()
  // Check for first run and present selection if true
  const isFirstRun = firstRun()
  if (isFirstRun) {
    selectionWindow()
  } else {
    run()
  }
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) openMain()
})

function createMainMenus() { 
  const mainTemplate = [
    {
      label: 'File',
      submenu: [
        {
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'delete'},
        {role: 'selectall'}
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Open in Browser...',
          click () {
            require('electron').shell.openExternal('http://localhost:' + port)
          }
        },
        {
          type: 'separator'
        },
        {role: 'reload'},
        {role: 'forcereload'},
        {role: 'toggledevtools'},
        {type: 'separator'},
        {role: 'resetzoom'},
        {role: 'zoomin'},
        {role: 'zoomout'},
        {type: 'separator'},
        {role: 'togglefullscreen'}
      ]
    },
    {
      label: 'Console',
      submenu: [
        {
          label: 'Show logs',
          click () {consoleWindow ? consoleWindow.show() : openConsoleWindow()}
        },
        {
          label: 'Hide logs',
          click () {consoleWindow.hide()}
        }
      ]
    },
    {
      label: 'Profile',
      submenu: [
        {
          label: 'New/Update',
          click: async() => {
            data = {newUser: ["Governance", "Plugin → Token-Distribution-Superalgos"]}
            mainWindow.webContents.send("fromMaster", data)
          }
        },
        {
          label: 'Save',
          click: async() => {
            let modifiers = []
            modifiers.push('shift')
            modifiers.push('control')
            mainWindow.webContents.sendInputEvent({type: 'keyDown', modifiers, keyCode: "s"})
            mainWindow.webContents.sendInputEvent({type: 'char', modifiers, keyCode: "s"})
            mainWindow.webContents.sendInputEvent({type: 'keyUp', modifiers, keyCode: "s"})
          }
        },
        {
          label: 'Submit',
          click: async() => {
            data = {submit: ["gov.userProfile"]}
            mainWindow.webContents.send("fromMaster", data)
            mainWindow.webContents.sendInputEvent({type: 'keyDown', modifiers, keyCode: "Enter"})
            mainWindow.webContents.sendInputEvent({type: 'keyUp', modifiers, keyCode: "Enter"})
          }
        }
      ]
    }
  ]

  const mainMenu = Menu.buildFromTemplate(mainTemplate)
  Menu.setApplicationMenu(mainMenu)
}

function createConsoleMenus () {
  const consoleTemplate = [
    {
      label: 'File',
      submenu: [
        {
          role: 'quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'delete'},
        {role: 'selectall'}
      ]
    },
    {
      label: 'View',
      submenu: [
        {role: 'reload'},
        {role: 'forcereload'},
        {role: 'toggledevtools'},
        {type: 'separator'},
        {role: 'resetzoom'},
        {role: 'zoomin'},
        {role: 'zoomout'},
        {type: 'separator'},
        {role: 'togglefullscreen'}
      ]
    },
    {
      label: 'Show UI',
      id: 'ui',
      click () {mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show()}
    }
  ]

  const consoleMenu = Menu.buildFromTemplate(consoleTemplate)
  Menu.setApplicationMenu(consoleMenu)
}