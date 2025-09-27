const copies = document.querySelector('.copies')
const clearAll = document.querySelector('.clear-all')
const toast = document.querySelector('.toast')
const contentEl = document.querySelector('.content')
const maxLength = 10
let lastestHistory
let emptyEl
if (copies.childNodes.length < 1) {
  createEmptyEle()
}
console.log(import.meta.url)
copies.addEventListener('click', async (event) => {
  const clickedLi = event.target.closest('.copy')
  let payload = {}
  if (clickedLi) {
    const type = clickedLi.dataset.type
    if (type === 'txt') {
      payload.type = 'txt'
      payload.content = clickedLi.textContent
    }else if (type === 'img') {
      payload.type = 'img'
      payload.content = clickedLi.firstChild?.getAttribute('src')
    }else {
      console.log('类型没有匹配上')
    }
    await window.electronAPI.setContent(payload)
    showToast()
  }
})

function showToast() {
  toast.classList.remove('hidden')
  setTimeout(() => {
    toast.classList.add('hidden')
  }, 2000)
}

function createHistoryItem(value) {
  if (value.type !== 'txt' && value.type !== 'img') {
    console.log(value.type)
    return
  }
  if (emptyEl) {
    contentEl.removeChild(emptyEl)
    emptyEl = null
  }
  //最多10个元素
  if (copies.childNodes.length > maxLength) {
    copies.removeChild(copies.lastChild)
  }
  const copy = createEle({
    elName: 'li',
    className: 'copy',
    attributes: {
      'data-type': value.type
    }
  })
  if (value.type === 'txt') {
    const copyContent = document.createTextNode(value.content)
    copy.appendChild(copyContent)
  } else if (value.type === 'img'){
    //校验图片是否存在
    
    const img = createEle({
      elName: 'img',
      className: 'copy-image',
      attributes: {
        src: value.content
      }
    })
    copy.appendChild(img)
  }
  copies.prepend(copy)
}

queryLocalStorageAndCreate()
function queryLocalStorageAndCreate() {
  try {
    const raw = localStorage.getItem('historys')
    const history = raw ? JSON.parse(raw) : []
    if (!Array.isArray(history)) throw new Error('Invalid history data')
    history.forEach(item => {
      createHistoryItem(item)
    })
    lastestHistory = history.at(-1)
    Promise.resolve().then(() => {
      window.electronAPI.setReady()
    })
  } catch (error) {
    console.log('failed to load history', error)
    localStorage.setItem('historys', [])
  }
}

window.electronAPI.onContent((value) => {
  if (lastestHistory && value && lastestHistory.content === value.content && lastestHistory.type === value.type) {
    return
  }
  createHistoryItem(value)
  saveLocalStorage(value)
})

function saveLocalStorage(value) {
  const history = JSON.parse(localStorage.getItem('historys') || '[]') 
  if (history.length > maxLength) {
    history.shift()
  }
  history.push(value)
  localStorage.setItem('historys', JSON.stringify(history))
}

clearAll.addEventListener('click', () => {
  copies.replaceChildren()
  createEmptyEle()
  localStorage.setItem('historys', '[]')
  //通知main,清空剪贴板
  window.electronAPI.setClear()
})

function createEmptyEle() {
  if (emptyEl && emptyEl.parentNode) return
  emptyEl = createEle({
    elName: 'div',
    className: 'empty',
  })
  const emptyContent = document.createTextNode('暂无数据')
  emptyEl.appendChild(emptyContent)
  contentEl.appendChild(emptyEl)
}

function createEle({ elName, className='', attributes={} }) {
  let element 
  if (elName) {
    element = document.createElement(elName)
    element.className = className
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value)
    }
  }
  return element
}