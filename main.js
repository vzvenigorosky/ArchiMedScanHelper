const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, // to use node features like require
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.maximize();
  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Create custom Menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'Menu',
      submenu: [
        { label: 'Developer Tools', click() { mainWindow.webContents.openDevTools(); } },
        { label: 'Reload', role: 'reload' }
      ]
    }
  ]);
  
  Menu.setApplicationMenu(menu);


  ipcMain.on('open-source-dialog', () => {
    dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    }).then(result => {
      if (!result.canceled) {
        mainWindow.webContents.send('source-directory-selected', result.filePaths[0]);
      }
    });
  });

  ipcMain.on('open-target-dialog', () => {
    dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    }).then(result => {
      if (!result.canceled) {
        mainWindow.webContents.send('target-directory-selected', result.filePaths[0]);
      }
    });
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});
