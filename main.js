import { app, globalShortcut, clipboard, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { writeFile, existsSync, readdir, stat, unlink } from 'fs'
import { createHash } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
let tempDir
let lastContent
let lastHash
let clipboardInterval
function getImageFingerprint(image) {
  const size = image.getSize()
  const hash = createHash('md5')
  hash.update(`${size.width}x${size.height}`)
  const smallImage = image.resize({width: 10, height: 10})
  hash.update(smallImage.toPNG())
  return hash.digest('hex')
}

function getImageName(image, currentHash) {
  const ext = image.toDataURL().startsWith('data:image/png') ? 'png' : 'jpg'
  const imageName = `clipboard-${currentHash.substring(0, 8)}.${ext}`
  return join(tempDir, imageName)
}

function imageHandle() {
  const image = clipboard.readImage()
  if (image.isEmpty()) return
  const currentHash = getImageFingerprint(image)
  if (lastHash == currentHash) {
    return
  }
  lastHash = currentHash
  const path = getImageName(image, currentHash)
  const buffer = image.toPNG()
  writeFile(path, buffer, err => {
    if(err) {
      console.log('写入文件有问题', err)
    }else {
      win.webContents.send('content', {
        type: 'img',
        content: `file://${path.replace(/\\/g, '/')}`
      })
    }
  })
}

function txtHandle() {
  const content = clipboard.readText()
  if (content && lastContent != content) {
    if (lastContent?.trim() == content?.trim()) {
      return
    }
    win.webContents.send('content', {
      type: 'txt',
      content
    })
    lastContent = content
  }
}

function fileHandle() {}

function startClipboardMonitor() {
  if (clipboardInterval) return
  clipboardInterval = setInterval(() => {
    // 检查剪贴板中是否有图片格式
    const isImage = clipboard.availableFormats().includes('image/jpg') ||
                    clipboard.availableFormats().includes('image/png') || 
                    clipboard.availableFormats().includes('image/jpeg') ||
                    clipboard.availableFormats().includes('image/bmp')
    // const isFile = clipboard.availableFormats().includes('text/uri-list')
    const isFile = false
    if (isImage) {
      imageHandle()
    }else if (isFile){
      fileHandle()
    }else {
      txtHandle()
    }
  }, 500)
}

let win;
function createWindow() {
  win = new BrowserWindow({
    // width: 340,
    width: 800,
    height: 600,
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
    },
  })
  win.loadFile('index.html')
  win.webContents.openDevTools()
}

function handleClear() {
  clipboard.clear()
}

//注册快捷键
function registerMainEvent() {
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (win && !win.isDestroyed()) {
      if (win.isVisible()) {
        win.focus()
      }else {
        win.show()
      }
    }else {
      createWindow()
    }
  })
}

async function handleSetContent(_, payload) {
  const { content, type } = payload
  if (type === 'img') {
    let imagePath = content
    if (imagePath.startsWith('file://')) {
      imagePath = decodeURIComponent(imagePath.replace('file://', ''))
    }
    if (!existsSync(imagePath)) {
      console.error('❌ 文件不存在:', imagePath)
      return
    }
    const image = nativeImage.createFromPath(imagePath)
    clipboard.writeImage(image)
  }else if (type === 'txt') {
    clipboard.writeText(content)
  }else {
    console.log('没有合适的type')
  }
  lastContent = content
}

function handleReady() {
  startClipboardMonitor()
}

//注册渲染器过来的事件
function registerRendererEvent() {
  //清除事件
  ipcMain.on('clear', handleClear)
  //dom创建完成事件
  ipcMain.on('ready', handleReady)
  ipcMain.handle('set-content', handleSetContent)
}

app.whenReady().then(() => {
  tempDir = app.getPath('temp')
  createWindow()
  registerMainEvent()
  registerRendererEvent()
  startClearupTempImagesMonitor()
  //如果没有窗口打开则打开一个窗口 (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
function startClearupTempImagesMonitor() {
  setInterval(clearupTempImages, 1000)
}

function clearupTempImages() {
  const now = Date.now()
  const expireTime = 60 * 60 * 1000

  readdir(tempDir, (err, files) => {
    files.forEach(file => {
      if (file.startsWith('clipboard-')
          && (file.endsWith('.jpg') 
          || file.endsWith('.png')
          || file.endsWith('.jpeg'))) {
        const fullPath = join(tempDir, file)
        stat(fullPath, (err, stats) => {
          if (now - stats.mtime.getTime() > expireTime) {
            unlink(fullPath, (err) => {
              if (err) {
                console.log('删除过期文件失败', fullPath, err)
              }else {
                console.log('已删除过期文件', fullPath)
              }
            })
          }
        })    
      }
    })
  })
}

//关闭所有窗口时退出应用 (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregister('CommandOrControl+Shift+V')
  globalShortcut.unregisterAll()
})