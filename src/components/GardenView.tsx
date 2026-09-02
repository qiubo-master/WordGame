import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBookMeta, loadBookWords } from '../data'
import { coinsForGame } from '../engine/economy'
import { aggregateEffects } from '../engine/items'
import { generateLevels, isLevelSelectionCleared, parseLevelSelection, wordsForSublevel } from '../engine/levels'
import { shuffle } from '../engine/random'
import { SFX, unlockAudio } from '../engine/sound'
import { speak } from '../engine/speech'
import { useAppStore, useCurrentUser, useSettings } from '../store/useAppStore'
import type { Word } from '../types'
import { ReplayConfirm } from './ReplayConfirm'

interface Props { levelId: string; onExit: () => void }
type PlantType = 'sunflower' | 'pea' | 'gatling' | 'sniper' | 'flame'
interface Plant { id:number; type:PlantType; lane:number; slot:number }
interface Zombie { id:number; lane:number; x:number; hp:number; maxHp:number }
const PLANTS: Record<PlantType,{name:string;cost:number;icon:string;shots:number;damage:number}> = {
  sunflower:{name:'向日葵',cost:50,icon:'🌻',shots:0,damage:0},
  pea:{name:'豌豆射手',cost:100,icon:'🌱',shots:1,damage:5},
  gatling:{name:'机枪豌豆',cost:400,icon:'🌿',shots:4,damage:20},
  sniper:{name:'狙击豌豆',cost:500,icon:'🎯',shots:40,damage:48},
  flame:{name:'烈焰豌豆',cost:1000,icon:'🔥',shots:10,damage:72},
}

function makeChoices(answer:Word,pool:Word[]){const out=[answer];for(const word of shuffle(pool)){if(out.length>=4)break;if(word.id!==answer.id&&!out.some(x=>x.meaning===word.meaning))out.push(word)}return shuffle(out)}

export function GardenView({levelId,onExit}:Props){
  const selection=useMemo(()=>parseLevelSelection(levelId),[levelId])
  const user=useCurrentUser(); const settings=useSettings(); const bookId=user?.activeBookId??null
  const replayRun=useRef(!!user&&isLevelSelectionCleared(user.levelProgress,levelId))
  const recordGameResult=useAppStore(s=>s.recordGameResult); const markWrong=useAppStore(s=>s.markWrong); const markRight=useAppStore(s=>s.markRight); const consumeEquipped=useAppStore(s=>s.consumeEquipped)
  const meta=bookId?getBookMeta(bookId):undefined; const [bookWords,setBookWords]=useState<Word[]>([])
  useEffect(()=>{if(!bookId)return setBookWords([]);let alive=true;loadBookWords(bookId).then(w=>alive&&setBookWords(w));return()=>{alive=false}},[bookId])
  const level=useMemo(()=>meta?generateLevels({meta,words:bookWords},settings).find(x=>x.id===selection.baseLevelId):undefined,[meta,bookWords,settings,selection.baseLevelId])
  const words=useMemo(()=>{const ix=new Map(bookWords.map(w=>[w.id,w]));return level?wordsForSublevel(level.wordIds,selection.sublevel).map(id=>ix.get(id)).filter((w):w is Word=>!!w):[]},[bookWords,level,selection.sublevel])
  const effects=useMemo(()=>aggregateEffects(user?.equipped??[]),[user?.equipped])
  const [phase,setPhase]=useState<'ready'|'playing'|'won'|'lost'>('ready'); const [sun,setSun]=useState(0); const [baseHp,setBaseHp]=useState(settings.gardenBaseHp)
  const [showReplayConfirm,setShowReplayConfirm]=useState(false)
  const [plants,setPlants]=useState<Plant[]>([]); const [zombies,setZombies]=useState<Zombie[]>([]); const [selected,setSelected]=useState<PlantType>('sunflower')
  const [q,setQ]=useState(0); const [picked,setPicked]=useState<string|null>(null); const [score,setScore]=useState(0); const [correct,setCorrect]=useState(0); const [wrong,setWrong]=useState(0); const [combo,setCombo]=useState(0); const [maxCombo,setMaxCombo]=useState(0); const [wave,setWave]=useState(0); const [flash,setFlash]=useState(0)
  const seq=useRef(0); const startedAt=useRef(Date.now()); const recorded=useRef(false); const current=words.length?words[q%words.length]:null; const choices=useMemo(()=>current?makeChoices(current,words):[],[current,words])
  const damageMult=1+effects.scoreBonus/100
  const begin=()=>{unlockAudio();replayRun.current=!!user&&isLevelSelectionCleared(user.levelProgress,levelId);consumeEquipped();recorded.current=false;startedAt.current=Date.now();setSun(50+effects.extraTime*5);setBaseHp(settings.gardenBaseHp+effects.shield*20);setPlants([]);setZombies([]);setScore(0);setCorrect(0);setWrong(0);setCombo(0);setMaxCombo(0);setWave(0);setPicked(null);setPhase('playing')}

  useEffect(()=>{if(phase!=='playing')return;const timer=window.setInterval(()=>{setWave(w=>{if(w>=settings.gardenWaves)return w;const next=w+1;const hp=settings.gardenZombieHp+next*5;setZombies(z=>[...z,{id:++seq.current,lane:Math.floor(Math.random()*3),x:96,hp,maxHp:hp}]);return next})},settings.gardenWaveInterval);return()=>clearInterval(timer)},[phase])
  useEffect(()=>{if(phase!=='playing')return;const timer=window.setInterval(()=>setSun(s=>s+plants.filter(p=>p.type==='sunflower').length),1000);return()=>clearInterval(timer)},[phase,plants])
  useEffect(()=>{if(phase!=='playing')return;const timer=window.setInterval(()=>{
    setZombies(previous=>{const next=previous.map(z=>({...z}));for(const plant of plants){const cfg=PLANTS[plant.type];if(!cfg.damage)continue;const target=next.filter(z=>z.lane===plant.lane&&z.hp>0).sort((a,b)=>a.x-b.x)[0];if(target)target.hp-=cfg.damage*damageMult/4}
      for(const zombie of next){if(zombie.hp<=0)continue;zombie.x-=.48;if(zombie.x<=4){setBaseHp(0);zombie.x=7}}
      const alive=next.filter(z=>z.hp>0);if(alive.length<next.length){setScore(s=>s+15);setSun(s=>s+5);setFlash(f=>f+1)}return alive})
  },250);return()=>clearInterval(timer)},[phase,plants,damageMult])
  useEffect(()=>{if(phase!=='playing')return;if(baseHp<=0){setPhase('lost');SFX.lose()}else if(wave>=settings.gardenWaves&&zombies.length===0){setPhase('won');SFX.win()}},[phase,baseHp,wave,zombies.length])
  useEffect(()=>{if((phase!=='won'&&phase!=='lost')||recorded.current||!level||!meta)return;recorded.current=true;const passed=phase==='won';recordGameResult({levelId,bookId:meta.id,score,correct,wrong,maxCombo,durationMs:Date.now()-startedAt.current,coinsEarned:coinsForGame(settings,score,wrong,passed,replayRun.current),passed,playedAt:Date.now(),targetScore:level.targetScore})},[phase,level,levelId,meta,score,correct,wrong,maxCombo,settings,recordGameResult])

  const answer=(choice:Word)=>{if(!current||picked)return;setPicked(choice.id);speak(current.word);if(choice.id===current.id){const c=combo+1;setSun(s=>s+50);setScore(s=>s+10+c);setCorrect(v=>v+1);setCombo(c);setMaxCombo(v=>Math.max(v,c));markRight(current.id);SFX.hit()}else{setWrong(v=>v+1);setCombo(0);markWrong(current.id,bookId??'');SFX.miss()}window.setTimeout(()=>{setQ(v=>v+1);setPicked(null)},700)}
  const plantAt=useCallback((lane:number,slot:number)=>plants.find(p=>p.lane===lane&&p.slot===slot),[plants])
  const place=(lane:number,slot:number)=>{if(plantAt(lane,slot))return;const cfg=PLANTS[selected];if(sun<cfg.cost)return;setSun(s=>s-cfg.cost);setPlants(p=>[...p,{id:++seq.current,type:selected,lane,slot}]);SFX.pop()}

  if(!meta||!level||words.length<4)return <div className="empty">加载花园中…</div>
  if(phase==='ready')return <div className="garden-ready"><div className="garden-logo">🌻<span>VS</span>🧟</div><h2>{level.name} · 词语保卫战</h2><p>每答对一道题获得 50 阳光。种植植物，守住三条草坪并消灭 {settings.gardenWaves} 波僵尸。</p><div className="garden-rules">🌻 50 阳光 · 每秒 +1　🌱 100 阳光 · 每秒 1 发<br/>🌿 400 · 每秒 4 发　🎯 500 · 每秒 40 发　🔥 1000 · 每秒 10 个烈焰球</div><button className="btn garden-start" onClick={begin}>开始保卫</button><button className="btn ghost" onClick={onExit}>返回关卡</button></div>
  if(phase==='won'||phase==='lost'){const won=phase==='won';const coins=coinsForGame(settings,score,wrong,won,replayRun.current);return <div className={`garden-result ${won?'won':'lost'}`}><div className="garden-result-icon">{won?'🌻🏆':'🧟💥'}</div><h2>{won?'花园保卫成功！':'僵尸突破防线'}</h2><p>{score} 分 · 答对 {correct} · +{coins} 金币{replayRun.current?'（重玩上限 10）':''}</p><div className="btn-row"><button className="btn ghost" onClick={onExit}>返回</button><button className="btn" onClick={()=>user&&isLevelSelectionCleared(user.levelProgress,levelId)?setShowReplayConfirm(true):begin()}>再来一局</button></div><ReplayConfirm open={showReplayConfirm} onCancel={()=>setShowReplayConfirm(false)} onContinue={()=>{setShowReplayConfirm(false);begin()}}/></div>}
  return <div className="garden-game"><div className="garden-top"><span>☀️ <b>{sun}</b></span><span>波次 {wave}/{settings.gardenWaves}</span><span>🏠 {Math.ceil(baseHp)}/{settings.gardenBaseHp}</span></div><div className="plant-picker">{(Object.keys(PLANTS) as PlantType[]).map(type=>{const p=PLANTS[type];return <button key={type} className={selected===type?'selected':''} disabled={sun<p.cost} onClick={()=>setSelected(type)}><i>{p.icon}</i><b>{p.cost}</b><small>{p.name}</small></button>})}</div><div className="garden-field">
    {[0,1,2].map(lane=><div className="garden-lane" key={lane}>{[0,1,2,3,4].map(slot=>{const plant=plantAt(lane,slot);return <button key={slot} className="garden-cell" onClick={()=>place(lane,slot)}>{plant&&<span className={`plant plant-${plant.type}`}>{PLANTS[plant.type].icon}<i className="plant-shot">•</i></span>}</button>})}{zombies.filter(z=>z.lane===lane).map(z=><span key={z.id} className="zombie" style={{left:`${z.x}%`}}>🧟<i><b style={{width:`${z.hp/z.maxHp*100}%`}}/></i></span>)}</div>)}<div className="garden-house">🏠</div><div key={flash} className="sun-flash">+5</div></div>
    {current&&<div className="garden-question"><div><strong>{current.word}</strong><button onClick={()=>speak(current.word)}>🔊</button><span>答对 +50 ☀️</span></div><div className="garden-options">{choices.map(choice=><button key={choice.id} disabled={!!picked} className={picked?choice.id===current.id?'right':choice.id===picked?'wrong':'':''} onClick={()=>answer(choice)}>{choice.meaning}</button>)}</div></div>}
  </div>
}
