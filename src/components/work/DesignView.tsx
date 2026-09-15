import { useCallback, useEffect, useRef, useState } from 'react'
import BackToFolders from './BackToFolders'
import PostersDeck from './PostersDeck'
import './design.css'

const SECTIONS = ['posters'] as const

/** SELECTED WORK › DESIGN —— 海报墙 */
export default function DesignView() {
  const [sec, setSec] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)
  const lock = useRef(false)

  const goto = useCallback((i: number) => {
    const n = Math.max(0, Math.min(SECTIONS.length - 1, i))
    setSec(n)
    lock.current = true
    window.setTimeout(() => {
      lock.current = false
    }, 950)
  }, [])

  /* 整页纵向切换：滚轮 / 键盘。海报段的横向滚轮交由内部消费 */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)
      // 横向占优时始终留给当前作品组件；即使光标落在页点或底部按钮上，
      // 斜向触控板手势也不能误触发整页纵向切换。
      if (absY <= absX) return
      if ((e.target as HTMLElement)?.closest('[data-hscroll]')) {
        if (absY < 26) return
      }
      if (lock.current || absY < 14) return
      goto(sec + (e.deltaY > 0 ? 1 : -1))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') goto(sec + 1)
      if (e.key === 'ArrowUp' || e.key === 'PageUp') goto(sec - 1)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [sec, goto])

  return (
    <div className="wv dv">
      <BackToFolders />
      <span className="dv__index">
        {String(sec + 1).padStart(2, '0')} /
      </span>

      <div ref={railRef} className="dv__rail" style={{ transform: `translateY(${-sec * 100}%)` }}>
        <section className="dv__sec">
          <PostersDeck active={sec === 0} />
        </section>
      </div>

      <div className="dv__dots" aria-hidden>
        {SECTIONS.map((s, i) => (
          <button
            key={s}
            type="button"
            data-on={i === sec}
            onClick={() => goto(i)}
            aria-label={s}
          />
        ))}
      </div>
    </div>
  )
}
