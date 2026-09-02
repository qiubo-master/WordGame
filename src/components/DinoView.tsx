import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getBookMeta, loadBookWords } from '../data'
import { coinsForGame } from '../engine/economy'
import { generateLevels, isLevelSelectionCleared, parseLevelSelection } from '../engine/levels'
import { aggregateEffects, type AggregatedEffects } from '../engine/items'
import { shuffle } from '../engine/random'
import { SFX, unlockAudio } from '../engine/sound'
import { speak } from '../engine/speech'
import { useAppStore, useCurrentUser, useSettings } from '../store/useAppStore'
import type { Word } from '../types'
import { ReplayConfirm } from './ReplayConfirm'

interface Props { levelId:string; onExit:()=>void }
const TIERS=[
  {name:'基础小兵',icon:'🗡️',damage:1,color:'#82906d'},
  {name:'初级小兵',icon:'⚔️',damage:3,color:'#49925e'},
  {name:'中级小兵',icon:'🛡️',damage:8,color:'#367eb0'},
  {name:'高级小兵',icon:'🏹',damage:20,color:'#7658b4'},
  {name:'最终级小兵',icon:'🔱',damage:48,color:'#d08316'},
  {name:'巨人',icon:'🦾',damage:120,color:'#c9472c'},
] as const
function choicesFor(answer:Word,pool:Word[]){const out=[answer];for(const w of shuffle(pool)){if(out.length>=4)break;if(w.id!==answer.id&&!out.some(x=>x.meaning===w.meaning))out.push(w)}return shuffle(out)}
function mergeArmy(army:number[]){const next=[...army];for(let i=0;i<next.length-1;i++){const made=Math.floor(next[i]/2);next[i]%=2;next[i+1]+=made}return next}
function dinoDamageAt(seconds:number, interval:number, factor:number){
  const safeInterval = interval > 0 ? interval : 10
  return factor ** Math.floor(seconds / safeInterval)
}

export function DinoView({levelId,onExit}:Props){
  const selection=useMemo(()=>parseLevelSelection(levelId),[levelId])
  const user=useCurrentUser();const settings=useSettings();const bookId=user?.activeBookId??null;const meta=bookId?getBookMeta(bookId):undefined
  const replayRun=useRef(!!user&&isLevelSelectionCleared(user.levelProgress,levelId))
  const recordGameResult=useAppStore(s=>s.recordGameResult);const markWrong=useAppStore(s=>s.markWrong);const markRight=useAppStore(s=>s.markRight);const consumeEquipped=useAppStore(s=>s.consumeEquipped)
  const [bookWords,setBookWords]=useState<Word[]>([]);useEffect(()=>{if(!bookId)return setBookWords([]);let alive=true;loadBookWords(bookId).then(w=>alive&&setBookWords(w));return()=>{alive=false}},[bookId])
  const level=useMemo(()=>meta?generateLevels({meta,words:bookWords},settings).find(x=>x.id===selection.baseLevelId):undefined,[meta,bookWords,settings,selection.baseLevelId]);const words=useMemo(()=>{const ix=new Map(bookWords.map(w=>[w.id,w]));return level?.wordIds.map(id=>ix.get(id)).filter((w):w is Word=>!!w)??[]},[bookWords,level])
  const [phase,setPhase]=useState<'ready'|'playing'|'won'|'lost'>('ready');const [doge,setDoge]=useState(0);const [army,setArmy]=useState([0,0,0,0,0,0]);const [dinoHp,setDinoHp]=useState(1800);const [baseHp,setBaseHp]=useState(1000);const [q,setQ]=useState(0);const [picked,setPicked]=useState<string|null>(null);const [correct,setCorrect]=useState(0);const [wrong,setWrong]=useState(0);const [combo,setCombo]=useState(0);const [maxCombo,setMaxCombo]=useState(0);const [hit,setHit]=useState(0);const [roar,setRoar]=useState(0);const [elapsed,setElapsed]=useState(0);const recorded=useRef(false);const startedAt=useRef(Date.now())
  const [showReplayConfirm,setShowReplayConfirm]=useState(false)
  const equippedEffects=useMemo(()=>aggregateEffects(user?.equipped??[]),[user?.equipped]);const [sessionEffects,setSessionEffects]=useState<AggregatedEffects|null>(null);const effects=sessionEffects??equippedEffects;const baseMaxHp=settings.bossBaseHp+effects.shield*100
  const current=words.length?words[q%words.length]:null;const choices=useMemo(()=>current?choicesFor(current,words):[],[current,words]);const damage=army.reduce((sum,n,i)=>sum+n*TIERS[i].damage,0);const attackDamage=Math.round(damage*(1+effects.scoreBonus/100));const score=Math.max(0,settings.bossHp-Math.ceil(dinoHp))+correct*10
  const begin=()=>{unlockAudio();replayRun.current=!!user&&isLevelSelectionCleared(user.levelProgress,levelId);setSessionEffects(equippedEffects);consumeEquipped();recorded.current=false;startedAt.current=Date.now();setDoge(Math.floor(equippedEffects.extraTime/10));setArmy([0,0,0,0,0,0]);setDinoHp(settings.bossHp);setBaseHp(settings.bossBaseHp+equippedEffects.shield*100);setCorrect(0);setWrong(0);setCombo(0);setMaxCombo(0);setPicked(null);setElapsed(0);setPhase('playing')}
  const recruit=()=>{if(doge<1)return;setDoge(v=>v-1);setArmy(a=>mergeArmy([a[0]+1,...a.slice(1)]));SFX.pop()}
  useEffect(()=>{if(phase!=='playing')return;const timer=window.setInterval(()=>{if(damage>0){setDinoHp(h=>Math.max(0,h-attackDamage));setHit(v=>v+1)}setElapsed(seconds=>{setBaseHp(h=>Math.max(0,h-dinoDamageAt(seconds,settings.bossRampInterval,settings.bossRampFactor)));return seconds+1})},1000);return()=>clearInterval(timer)},[phase,attackDamage,dinoHp])
  useEffect(()=>{if(phase!=='playing')return;if(dinoHp<=0){setPhase('won');SFX.win()}else if(baseHp<=0){setPhase('lost');SFX.lose()}},[phase,dinoHp,baseHp])
  useEffect(()=>{if((phase!=='won'&&phase!=='lost')||recorded.current||!level||!meta)return;recorded.current=true;const passed=phase==='won';recordGameResult({levelId,bookId:meta.id,score,correct,wrong,maxCombo,durationMs:Date.now()-startedAt.current,coinsEarned:coinsForGame(settings,score,wrong,passed,replayRun.current),passed,playedAt:Date.now(),targetScore:level.targetScore})},[phase,level,levelId,meta,score,correct,wrong,maxCombo,settings,recordGameResult])
  const answer=(choice:Word)=>{if(!current||picked)return;setPicked(choice.id);speak(current.word);if(choice.id===current.id){const c=combo+1;setDoge(v=>v+1);setCorrect(v=>v+1);setCombo(c);setMaxCombo(v=>Math.max(v,c));markRight(current.id);SFX.hit()}else{setWrong(v=>v+1);setCombo(0);markWrong(current.id,bookId??'');setRoar(v=>v+1);SFX.miss()}window.setTimeout(()=>{setQ(v=>v+1);setPicked(null)},800)}
  if(!meta||!level||words.length<4)return <div className="empty">Boss 巢穴加载中…</div>
  if(phase==='ready')return <div className="dino-ready"><div className="dino-title-art">🦖<span>VS</span>🪖</div><h2>{level.name} · Boss 打恐龙</h2><p>答对一题获得 1 狗币。每个狗币招募一个小兵，两个同级小兵会自动合成更高等级，直到诞生巨人！</p><div className="merge-chain">🗡️×2 → ⚔️×2 → 🛡️×2 → 🏹×2 → 🔱×2 → 🦾</div><button className="btn dino-start" onClick={begin}>挑战恐龙 Boss</button><button className="btn ghost" onClick={onExit}>返回关卡</button></div>
  if(phase==='won'||phase==='lost'){const won=phase==='won';const coins=coinsForGame(settings,score,wrong,won,replayRun.current);return <div className={`dino-result ${won?'won':'lost'}`}><div>{won?'🦾🏆':'🦖💥'}</div><h2>{won?'恐龙 Boss 被击败！':'军营被恐龙摧毁'}</h2><p>{score} 分 · 答对 {correct} · +{coins} 金币{replayRun.current?'（重玩上限 10）':''}</p><div className="btn-row"><button className="btn ghost" onClick={onExit}>返回</button><button className="btn" onClick={()=>user&&isLevelSelectionCleared(user.levelProgress,levelId)?setShowReplayConfirm(true):begin()}>再次挑战</button></div><ReplayConfirm open={showReplayConfirm} onCancel={()=>setShowReplayConfirm(false)} onContinue={()=>{setShowReplayConfirm(false);begin()}}/></div>}
  return <div className="dino-game"><div className="dino-stats"><span>🐶 狗币 <b>{doge}</b></span><span>军营 {Math.ceil(baseHp)}/{baseMaxHp}</span><span>火力 {attackDamage}/秒</span><span>🦖 -{dinoDamageAt(elapsed, settings.bossRampInterval, settings.bossRampFactor)}/次 · {elapsed}s</span></div><div className="dino-arena"><div key={`base-${elapsed}`} className={`dino-base${elapsed>0?' base-taking-hit':''}`}>⛺<i><b style={{width:`${baseHp/baseMaxHp*100}%`}}/></i></div><div key={hit} className="army-line">{army.map((n,i)=>n>0&&<span key={i} style={{'--army-color':TIERS[i].color} as CSSProperties}>{TIERS[i].icon}<b>×{n}</b></span>)}</div><div key={`boss-${hit}-${roar}`} className={`dino-boss${attackDamage>0?' dino-taking-hit':''}`}><span>🦖</span><i><b style={{width:`${dinoHp/settings.bossHp*100}%`}}/></i><small>{Math.ceil(dinoHp)}/{settings.bossHp}</small></div>{elapsed>0&&<><span key={`enemy-shot-${elapsed}`} className="dino-projectile enemy-shot">🔥</span><span key={`base-damage-${elapsed}`} className="damage-float base-damage">-{dinoDamageAt(elapsed-1, settings.bossRampInterval, settings.bossRampFactor)}</span></>}{attackDamage>0&&<><span key={`player-shot-${hit}`} className="dino-projectile player-shot">💫</span><span key={`boss-damage-${hit}`} className="damage-float boss-damage">-{attackDamage}</span><div key={`slash-${hit}`} className="attack-slash">⚡</div></>}</div><div className="dino-recruit"><button disabled={doge<1} onClick={recruit}>🐶 1 狗币 · 招募小兵</button><span>招募后自动合成</span></div><div className="army-roster">{TIERS.map((tier,i)=><div key={tier.name} className={army[i]?'owned':''}><span>{tier.icon}</span><b>{army[i]}</b><small>{tier.name}<br/>{Math.round(tier.damage*(1+effects.scoreBonus/100))} 伤害/秒</small></div>)}</div>
  {current&&<div className="dino-question"><div><strong>{current.word}</strong><button onClick={()=>speak(current.word)}>🔊</button><span>答对 +1 🐶</span></div><div>{choices.map(choice=><button key={choice.id} disabled={!!picked} className={picked?choice.id===current.id?'right':choice.id===picked?'wrong':'':''} onClick={()=>answer(choice)}>{choice.meaning}</button>)}</div></div>}</div>
}
