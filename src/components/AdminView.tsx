import { useEffect, useMemo, useState } from 'react'
import { useAppStore, useSettings } from '../store/useAppStore'
import {
  clampSetting,
  DEFAULT_SETTINGS,
  SETTING_FIELDS,
  SETTING_GROUPS,
  targetScoreFor,
} from '../engine/settings'
import type { FieldMeta } from '../engine/settings'
import { getBookMeta } from '../data'
import { toast } from './Toast'

function NumberField({ meta, value }: { meta: FieldMeta; value: number }) {
  const update = useAppStore((s) => s.updateSettings)
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = () => {
    const n = parseFloat(draft)
    if (Number.isNaN(n)) {
      setDraft(String(value))
      return
    }
    const next = clampSetting(meta, n)
    if (next !== value) {
      update({ [meta.key]: next })
      toast(`${meta.label} 已改为 ${next === 0 && meta.unlimited ? '不限' : next}`)
    } else {
      setDraft(String(value))
    }
  }

  if (meta.options) {
    return (
      <div className="seg">
        {meta.options.map((o) => (
          <button
            key={o}
            className={o === value ? 'on' : ''}
            onClick={() => update({ [meta.key]: o })}
          >
            {o} {meta.unit}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="num-field">
      <input
        className="input num"
        type="number"
        inputMode="decimal"
        value={draft}
        min={meta.min}
        max={meta.max}
        step={meta.step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
      />
      <span className="unit">{meta.unit}</span>
      {meta.unlimited && (
        <span className="tiny muted">{value === 0 ? '不限' : '填 0 = 不限'}</span>
      )}
    </div>
  )
}

export function AdminView({ onExit }: { onExit: () => void }) {
  const settings = useSettings()
  const updateSettings = useAppStore((s) => s.updateSettings)
  const resetSettings = useAppStore((s) => s.resetSettings)
  const [pass, setPass] = useState('')
  const [showDanger, setShowDanger] = useState(false)

  const preview = useMemo(() => {
    const book = getBookMeta('junior')
    const count = book?.wordCount ?? 0
    const levels = book ? Math.ceil(count / Math.max(1, settings.unitSize)) : 0
    return {
      levelCount: levels,
      s1: targetScoreFor(settings, 0),
      s2: targetScoreFor(settings, 1),
      s5: targetScoreFor(settings, 4),
    }
  }, [settings])

  return (
    <div>
      <div className="card" style={{ marginTop: 12, borderColor: 'rgba(83,74,183,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>管理员模式</span>
          <span className="tag">改动立即生效</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          改完直接返回，不需要保存。所有数值改动会持久保存在本机。
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 500 }}>当前效果</div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          初中课标共 {preview.levelCount} 关 · 第 1 关 {preview.s1} 分 · 第 2 关 {preview.s2} 分 ·
          第 5 关 {preview.s5} 分
        </div>
        <div className="effect-chips">
          <span className="chip">
            每日新学 {settings.dailyNewLimit === 0 ? '不限' : `${settings.dailyNewLimit} 词`}
          </span>
          <span className="chip">
            背词金币上限 {settings.dailyCoinCap === 0 ? '不限' : `${settings.dailyCoinCap}`}
          </span>
          <span className="chip">金币倍率 {settings.coinMultiplier}×</span>
          <span className="chip">每局 {settings.gameDuration} 秒</span>
          <span className="chip">
            背 {settings.unlockThreshold} 词解锁一关
          </span>
        </div>
      </div>

      {SETTING_GROUPS.map((group) => (
        <div key={group}>
          <div className="section-title">{group}</div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {SETTING_FIELDS.filter((f) => f.group === group).map((meta) => (
              <div key={meta.key} className="set-row">
                <div className="set-label">
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{meta.label}</div>
                  <div className="tiny muted">{meta.hint}</div>
                </div>
                <NumberField meta={meta} value={settings[meta.key] as number} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="section-title">系统</div>
      <div className="card">
        <div className="set-row">
          <div className="set-label">
            <div style={{ fontSize: 14, fontWeight: 500 }}>游戏音效</div>
            <div className="tiny muted">关闭后所有音效静音</div>
          </div>
          <button
            className={`mini-btn${settings.soundOn ? '' : ' off'}`}
            onClick={() => updateSettings({ soundOn: !settings.soundOn })}
          >
            {settings.soundOn ? '开启' : '关闭'}
          </button>
        </div>
        <div className="set-row">
          <div className="set-label">
            <div style={{ fontSize: 14, fontWeight: 500 }}>管理员口令</div>
            <div className="tiny muted">进入本面板需要输入的口令</div>
          </div>
          <div className="num-field">
            <input
              className="input num"
              value={pass}
              placeholder={settings.adminPasscode}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn ghost"
          onClick={() => {
            const v = pass.trim()
            if (v.length < 3) {
              toast('口令至少 3 位')
              return
            }
            useAppStore.getState().updateSettings({ adminPasscode: v })
            setPass('')
            toast('口令已更新')
          }}
        >
          保存新口令
        </button>

        <div style={{ height: 12 }} />
        {!showDanger ? (
          <button className="btn ghost" onClick={() => setShowDanger(true)}>
            恢复默认设置
          </button>
        ) : (
          <>
            <div className="tiny" style={{ color: 'var(--danger)', marginBottom: 8 }}>
              所有参数会恢复到初始值，学习进度不受影响。确定吗？
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setShowDanger(false)}>
                取消
              </button>
              <button
                className="btn"
                style={{ background: 'var(--danger)' }}
                onClick={() => {
                  resetSettings()
                  setShowDanger(false)
                  toast('已恢复默认')
                }}
              >
                确定恢复
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ height: 12 }} />
      <button className="btn" onClick={onExit}>
        退出管理，返回应用
      </button>
      <div className="tiny muted center" style={{ marginTop: 10 }}>
        当前口令：{settings.adminPasscode}
        {settings.adminPasscode === DEFAULT_SETTINGS.adminPasscode && '（默认，建议修改）'}
      </div>
    </div>
  )
}
