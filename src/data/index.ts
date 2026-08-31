import type { Word, WordBook, WordBookMeta } from '../types'

export type WordSeed = [string, string, string, string]

export function buildBook(meta: WordBookMeta, seeds: WordSeed[]): WordBook {
  const words: Word[] = seeds.map((s, i) => ({
    id: `${meta.id}-${i + 1}`,
    word: s[0],
    phonetic: s[1],
    pos: s[2],
    meaning: s[3],
  }))
  return { meta: { ...meta, wordCount: words.length }, words }
}

// ---- 静态元数据（不含单词内容，首屏极小）----
// wordCount 为各书实际生成词数（与数据文件一致）
const JUNIOR_META: WordBookMeta = {
  id: 'junior', name: '初中课标词汇', category: 'syllabus', stage: 'junior',
  wordCount: 1600, unlockThreshold: 50, description: '义务教育英语课程标准初中阶段词汇，按常用度排序', source: 'builtin', unitSize: 50,
}
const KET_META: WordBookMeta = {
  id: 'ket', name: 'KET 核心词汇', category: 'cambridge', stage: 'intl',
  wordCount: 1600, unlockThreshold: 50, description: '剑桥通用英语五级考试 KET（A2）核心词表', source: 'builtin', unitSize: 50,
}
const PET_META: WordBookMeta = {
  id: 'pet', name: 'PET 核心词汇', category: 'cambridge', stage: 'intl',
  wordCount: 3674, unlockThreshold: 50, description: '剑桥通用英语五级考试 PET（B1）核心词表', source: 'builtin', unitSize: 50,
}
const PRIMARY_META: WordBookMeta = {
  id: 'primary', name: '小学新课标词汇', category: 'syllabus', stage: 'primary',
  wordCount: 800, unlockThreshold: 30, description: '小学阶段基础词汇，按常用度排序', source: 'builtin', unitSize: 50,
}
const SENIOR_META: WordBookMeta = {
  id: 'senior', name: '高中课标词汇', category: 'syllabus', stage: 'senior',
  wordCount: 3674, unlockThreshold: 50, description: '普通高中英语课程标准词汇', source: 'builtin', unitSize: 50,
}
const CET_META: WordBookMeta = {
  id: 'cet', name: '四六级词汇（历史兼容）', category: 'exam', stage: 'exam',
  wordCount: 5802, unlockThreshold: 50, description: '原四六级合并词库，仅为保留已有学习记录', source: 'builtin', unitSize: 50,
}
const CET4_META: WordBookMeta = {
  id: 'cet4', name: '大学英语四级词汇', category: 'exam', stage: 'exam',
  wordCount: 4500, unlockThreshold: 50, description: '大学英语四级核心词汇，共 4500 词', source: 'builtin', unitSize: 50,
}
const CET6_META: WordBookMeta = {
  id: 'cet6', name: '大学英语六级新增词汇', category: 'exam', stage: 'exam',
  wordCount: 1302, unlockThreshold: 50, description: '大学英语六级新增进阶词汇，共 1302 词', source: 'builtin', unitSize: 50,
}
const KY_META: WordBookMeta = {
  id: 'ky', name: '考研核心词汇', category: 'exam', stage: 'exam',
  wordCount: 4801, unlockThreshold: 50, description: '考研英语核心词表', source: 'builtin', unitSize: 100,
}
const TOEFL_META: WordBookMeta = {
  id: 'toefl', name: '托福核心词汇', category: 'intl', stage: 'intl',
  wordCount: 6970, unlockThreshold: 50, description: '托福(TOEFL)核心词表', source: 'builtin', unitSize: 100,
}
const IELTS_META: WordBookMeta = {
  id: 'ielts', name: '雅思核心词汇', category: 'intl', stage: 'intl',
  wordCount: 5038, unlockThreshold: 50, description: '雅思(IELTS)核心词表', source: 'builtin', unitSize: 100,
}

const META_MAP: Record<string, WordBookMeta> = {
  junior: JUNIOR_META, ket: KET_META, pet: PET_META, primary: PRIMARY_META,
  senior: SENIOR_META, cet: CET_META, cet4: CET4_META, cet6: CET6_META, ky: KY_META, toefl: TOEFL_META, ielts: IELTS_META,
}

export const BOOK_METAS: WordBookMeta[] = [
  JUNIOR_META, KET_META, PET_META, PRIMARY_META, SENIOR_META, CET4_META, CET6_META, KY_META, TOEFL_META, IELTS_META,
]

export function getBookMeta(bookId: string): WordBookMeta | undefined {
  return META_MAP[bookId]
}

// ---- 按需动态加载（按书分包，首屏不加载词库内容）----
type SeedModule = Record<string, WordSeed[]>

const LOADERS: Record<string, () => Promise<SeedModule>> = {
  junior: () => import('./junior'),
  ket: () => import('./ket'),
  pet: () => import('./pet'),
  primary: () => import('./primary'),
  senior: () => import('./senior'),
  cet: () => import('./cet'),
  cet4: () => import('./cet'),
  cet6: () => import('./cet'),
  ky: () => import('./ky'),
  toefl: () => import('./toefl'),
  ielts: () => import('./ielts'),
}
const SEED_KEY: Record<string, string> = {
  junior: 'JUNIOR_SEEDS', ket: 'KET_SEEDS', pet: 'PET_SEEDS', primary: 'PRIMARY_SEEDS',
  senior: 'SENIOR_SEEDS', cet: 'CET_SEEDS', cet4: 'CET_SEEDS', cet6: 'CET_SEEDS', ky: 'KY_SEEDS', toefl: 'TOEFL_SEEDS', ielts: 'IELTS_SEEDS',
}

const wordCache = new Map<string, Word[]>()
const inflight = new Map<string, Promise<Word[]>>()

export async function loadBookWords(bookId: string): Promise<Word[]> {
  const cached = wordCache.get(bookId)
  if (cached) return cached
  const pending = inflight.get(bookId)
  if (pending) return pending
  const meta = META_MAP[bookId]
  const loader = LOADERS[bookId]
  if (!meta || !loader) return []
  const p = loader().then((mod) => {
    const allSeeds = (mod as SeedModule)[SEED_KEY[bookId]] as WordSeed[]
    const start = bookId === 'cet6' ? 4500 : 0
    const seeds = bookId === 'cet4' ? allSeeds.slice(0, 4500) : bookId === 'cet6' ? allSeeds.slice(4500) : allSeeds
    const words = (bookId === 'cet4' || bookId === 'cet6')
      ? seeds.map((seed, index) => ({
          id: `cet-${start + index + 1}`,
          word: seed[0], phonetic: seed[1], pos: seed[2], meaning: seed[3],
        }))
      : buildBook(meta, seeds).words
    wordCache.set(bookId, words)
    inflight.delete(bookId)
    return words
  })
  inflight.set(bookId, p)
  return p
}

export function getBookWordsSync(bookId: string): Word[] {
  return wordCache.get(bookId) ?? []
}

export function getBook(bookId: string): WordBook | undefined {
  const meta = META_MAP[bookId]
  if (!meta) return undefined
  return { meta, words: wordCache.get(bookId) ?? [] }
}

export function getWordIndex(bookId: string): Map<string, Word> {
  const map = new Map<string, Word>()
  const words = wordCache.get(bookId)
  if (words) for (const w of words) map.set(w.id, w)
  return map
}
