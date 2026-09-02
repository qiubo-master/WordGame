import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})
const win = dom.window

globalThis.window = win
globalThis.document = win.document
Object.defineProperty(globalThis, 'navigator', {
  value: win.navigator,
  configurable: true,
  writable: true,
})
globalThis.localStorage = win.localStorage
globalThis.HTMLElement = win.HTMLElement
globalThis.HTMLInputElement = win.HTMLInputElement
globalThis.Element = win.Element
globalThis.Node = win.Node
globalThis.Event = win.Event
globalThis.MouseEvent = win.MouseEvent
globalThis.getComputedStyle = win.getComputedStyle
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const mod = await import('./.smoke-dist/.smoke-entry.js')
const App = mod.App
const __store = mod.__store
const juniorMeta = mod.BOOK_METAS.find((b) => b.id === 'junior')
const juniorWords = await mod.loadBookWords('junior')
const junior = { meta: juniorMeta, words: juniorWords }
if (typeof App !== 'function') throw new Error(`App 导出异常: ${typeof App}`)

const act = React.act ?? React.default?.act
if (!act) throw new Error('找不到 act')

const root = createRoot(document.getElementById('root'))
const text = () => document.body.textContent ?? ''

let failed = 0
function check(label, cond, extra = '') {
  if (cond) console.log(`  OK   ${label}`)
  else {
    failed++
    console.log(`  FAIL ${label} ${extra}`)
  }
}

const uid = () => __store.getState().currentUserId
const cur = () => __store.getState().users[uid()]
const wrongIds = () => Object.keys(cur().wrongWords ?? {})

async function clickText(label, tag = 'button') {
  const el = [...document.querySelectorAll(tag)].find((e) => (e.textContent ?? '').includes(label))
  if (!el) throw new Error(`找不到可点击元素: ${label}`)
  await act(async () => {
    el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
}

async function clickEl(el) {
  await act(async () => {
    el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  })
}

async function clickSel(sel, idx = 0) {
  const el = document.querySelectorAll(sel)[idx]
  if (!el) throw new Error(`找不到元素: ${sel}`)
  await clickEl(el)
}

async function typeInto(sel, value) {
  const input = document.querySelector(sel)
  if (!input) throw new Error(`找不到输入框: ${sel}`)
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new win.Event('input', { bubbles: true }))
  })
}

async function setSetting(label, value) {
  const rows = [...document.querySelectorAll('.set-row')]
  const row = rows.find((r) => (r.textContent ?? '').includes(label))
  if (!row) throw new Error(`找不到设置项: ${label}`)
  const input = row.querySelector('input')
  if (!input) throw new Error(`${label} 没有输入框`)
  const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set
  await act(async () => {
    setter.call(input, String(value))
    input.dispatchEvent(new win.Event('input', { bubbles: true }))
  })
  await act(async () => {
    input.focus()
    input.blur()
  })
}

const wait = async (ms) => {
  await new Promise((r) => setTimeout(r, ms))
  await act(async () => {})
}

function currentWord() {
  const t = document.querySelector('.word-main')?.textContent?.trim() ?? ''
  return junior.words.find((w) => w.word === t)
}

function choiceByMeaning(meaning) {
  return [...document.querySelectorAll('.choice')].find((c) =>
    (c.textContent ?? '').includes(meaning),
  )
}

try {
  await act(async () => {
    root.render(React.createElement(App))
  })
  check('首次进入显示用户门', text().includes('单词闯关'))

  // ---- 管理员 ----
  for (let i = 0; i < 5; i++) await clickSel('.gate-logo')
  check('连点图标 5 次弹出口令框', text().includes('管理员验证'))
  await typeInto('input[type="password"]', 'wrongcode')
  await clickText('进入')
  check('错误口令被拒绝', text().includes('管理员验证'))
  await typeInto('input[type="password"]', 'admin888')
  await clickText('进入')
  check('正确口令进入管理面板', text().includes('管理员模式'))
  await setSetting('每局时长', 30)
  check('改参数即时生效', __store.getState().settings.gameDuration === 30)
  await clickText('恢复默认设置')
  await clickText('确定恢复')
  check('恢复默认生效', __store.getState().settings.gameDuration === 60)
  check('音效默认开启', __store.getState().settings.soundOn === true)
  await clickText('退出管理，返回应用')

  // ---- 建用户（游客模式）----
  await clickText('先不登录，直接玩')
  await typeInto('input', '小明')
  await clickText('开始学习')
  check('创建用户后进入首页', text().includes('今日进度'))
  check('首页显示不限量', text().includes('不限量'))

  await clickText('词库')
  await clickText('初中课标词汇')
  check('进入背单词页', text().includes('不认识，直接看答案'))
  check('显示 4 个选项', document.querySelectorAll('.choice').length === 4)
  check(
    '不限量时队列覆盖整本词库',
    text().includes(`/ ${junior.words.length}`),
    `实际: ${text().slice(0, 60)}`,
  )

  // ---- 故意答错 ----
  await act(async () => {
    __store.getState().addCoins(20, '测试启动金')
  })
  const w1 = currentWord()
  check('当前词能在词库中找到', !!w1, `实际: ${document.querySelector('.word-main')?.textContent}`)
  const wrongChoice = [...document.querySelectorAll('.choice')].find(
    (c) => !(c.textContent ?? '').includes(w1.meaning),
  )
  check('存在错误选项', !!wrongChoice)
  const coinsBeforeWrong = cur().wallet.coins
  await clickEl(wrongChoice)
  check('答错后金币减少', cur().wallet.coins < coinsBeforeWrong, `${coinsBeforeWrong} -> ${cur().wallet.coins}`)
  check('答错后有错误反馈', !!document.querySelector('.answer-bar.bad'))
  check('答错后自动进错误本', wrongIds().includes(w1.id), `错词本: ${wrongIds().join(',')}`)
  check('答错后高亮正确项', !!document.querySelector('.choice.right'))
  check('答错后高亮错误选择', !!document.querySelector('.choice.wrong-pick'))

  await clickText('记住了，继续')
  check('继续后回到未答状态', !document.querySelector('.answer-bar'))
  check('答错后题目数不减少', text().includes(`/ ${junior.words.length}`))

  // ---- 答对 ----
  const w2 = currentWord()
  const rightChoice = choiceByMeaning(w2.meaning)
  check('能定位到正确选项', !!rightChoice, `词: ${w2.word} 义: ${w2.meaning}`)
  const coinsBefore = cur().wallet.coins
  await clickEl(rightChoice)
  check('答对后有正确反馈', !!document.querySelector('.answer-bar.ok'))
  check('答对后金币增加', cur().wallet.coins > coinsBefore, `${coinsBefore} -> ${cur().wallet.coins}`)
  check('单词状态已写入', Object.keys(cur().wordStates).length > 0)

  check('答对后不自动跳（出现下一个按钮）', !!document.querySelector('.answer-bar.ok') && text().includes('下一个'))
  await clickText('下一个')
  check('点下一个后进入新词', currentWord()?.id !== w2.id)

  // ---- 不认识（不扣分，进错词本）----
  const w3 = currentWord()
  const coinsBeforeSkip = cur().wallet.coins
  await clickText('不认识，直接看答案')
  check('不认识后不计扣币', cur().wallet.coins === coinsBeforeSkip, `${coinsBeforeSkip} -> ${cur().wallet.coins}`)
  check('不认识后进入错词本', wrongIds().includes(w3.id))
  await act(async () => {
    __store.getState().clearWrongWord(w3.id)
  })
  await clickText('记住了，继续')

  // ---- 错词本 ----
  await clickText('错词')
  check('错词本有内容', text().includes('个错词'))
  check('错词本显示答错的词', text().includes(w1.word), `实际: ${text().slice(0, 80)}`)
  check('错词本显示错误次数', text().includes('错 1 次'))

  await clickText('只练这')
  check('进入错词练习模式', text().includes('错词练习'), `实际: ${text().slice(0, 60)}`)
  const dw = currentWord()
  check('错词练习的正是那个错词', dw?.id === w1.id, `实际: ${dw?.word}`)

  const dc = choiceByMeaning(dw.meaning)
  await clickEl(dc)
  await wait(1200)
  check('错词答对 1 次后仍在本里', wrongIds().includes(w1.id))

  await act(async () => {
    __store.getState().markRight(w1.id)
  })
  check('答对 2 次后自动移出错词本', !wrongIds().includes(w1.id))

  await clickText('错词')
  check('错词清空后显示空状态', text().includes('错词本是空的'))

  // ---- 商城 / 背包 ----
  await clickText('商城')
  check('商城列出小沙漏', text().includes('小沙漏'))
  await act(async () => {
    __store.getState().addCoins(500, '测试')
  })
  await clickText('商城')
  await clickText('50 金币')
  check('购买后背包有装备', cur().inventory.length > 0)
  await clickText('背包')
  check('背包显示装备槽', text().includes('装备槽'))

  // ---- 关卡与游戏 ----
  await clickText('首页')
  await clickText('闯关')
  check('闯关页显示关卡列表', text().includes('第 1 关'))

  await act(async () => {
    const s = __store.getState()
    const id = s.currentUserId
    const u = s.users[id]
    const ws = {}
    for (let i = 1; i <= 60; i++) {
      ws[`junior-${i}`] = {
        wordId: `junior-${i}`,
        bookId: 'junior',
        status: 'mastered',
        ease: 2.5,
        interval: 7,
        dueAt: Date.now() + 86400000,
        reviewCount: 1,
        correctCount: 1,
        wrongCount: 0,
      }
    }
    __store.setState({
      users: {
        ...s.users,
        [id]: {
          ...u,
          wordStates: ws,
          levelProgress: {
            ...u.levelProgress,
            'junior-L1::1': {
              levelId: 'junior-L1::1',
              bookId: 'junior',
              status: 'cleared',
              bestScore: 120,
              stars: 1,
              clearedAt: Date.now(),
            },
          },
        },
      },
    })
  })

  await clickText('首页')
  await clickText('闯关')
  const lv1 = [...document.querySelectorAll('.level-item')][0]
  check('掌握 60 词后第 1 关解锁', lv1 && !lv1.disabled)
  const matchEntry = [...lv1.querySelectorAll('button')].find((button) => button.textContent.includes('消消乐'))
  const battleEntry = [...lv1.querySelectorAll('button')].find((button) => button.textContent.includes('单词兵团'))
  check('第 1 小关通关后第 2 小关可挑战', matchEntry && !matchEntry.disabled)
  check('第 2 小关未通关时第 3 小关保持锁定', battleEntry?.disabled === true)

  // ---- 装备开局消耗 + 消消乐（限时）----
  await act(async () => {
    const s = __store.getState()
    s.addCoins(100, '测试')
    s.buyItem('woodshield')
    s.equipItem('woodshield', 0)
  })
  check('已装备木盾牌', cur().equipped[0] === 'woodshield')

  await clickText('消消乐')
  check('进入消消乐准备页', text().includes('消消乐'))
  check('准备页显示已装备（开局消耗）', text().includes('已装备'))

  const coinsBeforeGame = cur().wallet.coins
  await clickText('开始挑战')
  await wait(150)
  check('开局后已装备清空', cur().equipped.every((e) => e === null), JSON.stringify(cur().equipped))
  const woodLeft = cur().inventory.find((e) => e.itemId === 'woodshield')
  check('开局后背包消耗 1 件', !woodLeft, JSON.stringify(cur().inventory))
  check('消消乐已发牌', document.querySelectorAll('.match-card').length > 0)

  // 自动配对通关
  let safety = 0
  while (safety++ < 80) {
    if (text().includes('通关成功') || text().includes('还差')) break
    const cards = [...document.querySelectorAll('.match-card')].filter(
      (c) => !c.classList.contains('matched') && !c.classList.contains('flipped') && !c.disabled,
    )
    if (cards.length === 0) {
      await wait(150)
      continue
    }
    const byWord = {}
    for (const c of cards) {
      const w = c.getAttribute('data-wordid')
      if (w) (byWord[w] ||= []).push(c)
    }
    const wid = Object.keys(byWord)[0]
    const pair = byWord[wid]
    if (pair && pair.length >= 2) {
      await clickEl(pair[0])
      await wait(120)
      await clickEl(pair[1])
      await wait(260)
    } else {
      await wait(150)
    }
  }
  check('消消乐可通关', text().includes('通关成功'))
  check('通关后金币增加', cur().wallet.coins > coinsBeforeGame, `${coinsBeforeGame} -> ${cur().wallet.coins}`)

  await clickText('返回关卡')
  const battleAfterMatch = [...document.querySelectorAll('.level-item button')].find((button) => button.textContent.includes('单词兵团'))
  check('第 2 小关通关后第 3 小关解锁', battleAfterMatch && !battleAfterMatch.disabled)
  await clickText('打地鼠')
  check('已通关游戏弹出重玩提示', text().includes('本局最多获得 10 个金币'))
  await clickText('继续玩')
  check('进入游戏准备页', text().includes('开始挑战'))
  check('准备页显示目标分', text().includes('120 分'))

  await clickText('开始挑战')
  await wait(150)
  const moles = [...document.querySelectorAll('.mole')]
  check('地鼠已冒出', moles.length > 0)

  const targetMeaning = document.querySelector('.target-word .val')?.textContent ?? ''
  const targetWord = junior.words.find((w) => w.meaning === targetMeaning)
  check('目标释义能对应到单词', !!targetWord)
  const rightMole = moles.find((m) => (m.textContent ?? '').trim() === targetWord.word)
  check('正确地鼠在场上', !!rightMole)

  await clickEl(rightMole.closest('button'))
  check('命中后出现飘分', !!document.querySelector('.floater') || text().includes('连击 1'))
  check('命中后游戏仍在运行', !!document.querySelector('.hole-grid'))

  // 游戏点错也进错词本
  await wait(400)
  const moles2 = [...document.querySelectorAll('.mole')]
  if (moles2.length > 0) {
    const tm2 = document.querySelector('.target-word .val')?.textContent ?? ''
    const tw2 = junior.words.find((w) => w.meaning === tm2)
    const badMole = moles2.find((m) => (m.textContent ?? '').trim() !== tw2?.word)
    if (badMole) {
      const before = wrongIds().length
      await clickEl(badMole.closest('button'))
      check('游戏点错也进错词本', wrongIds().length > before, `${before} -> ${wrongIds().length}`)
    }
  }

  const persisted = win.localStorage.getItem('wordquest-v1')
  check('设置已持久化', !!persisted && persisted.includes('gameDuration'))
  check('数据已持久化', !!persisted && persisted.includes('小明'))
} catch (e) {
  failed++
  console.log(`  FAIL 异常: ${e.message}`)
  console.log(e.stack?.split('\n').slice(1, 3).join('\n'))
}

console.log(failed === 0 ? '\nSMOKE PASS' : `\nSMOKE FAIL (${failed})`)
process.exit(failed === 0 ? 0 : 1)
