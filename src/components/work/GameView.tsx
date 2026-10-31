import { useState } from 'react'
import { GAMES } from '../../data/content'
import BackToFolders from './BackToFolders'
import './game.css'

export default function GameView() {
  const [playing, setPlaying] = useState(false)
  const webGame = GAMES.find((g) => g.id === 'outside-the-frame')!
  const localGames = GAMES.filter((g) => g.url.startsWith('file:'))

  if (playing) {
    return (
      <div className="wv gv-player">
        <header className="gv-player__bar">
          <button type="button" onClick={() => setPlaying(false)}>← 返回游戏作品</button>
          <span>{webGame.name}</span>
        </header>
        <iframe
          className="gv-player__frame"
          src={webGame.url}
          title="画外的一笔 · 交互作品"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="wv gv">
      <BackToFolders />
      <header className="gv__head">
        <span className="gv__en">GAME</span>
        <span className="gv__cn">游戏作品</span>
      </header>
      <div className="gv__grid">
        {GAMES.map((g) => (
          <a
            key={g.id}
            className="gv__card"
            href={g.url}
            target={g.url.startsWith('file:') ? '_blank' : undefined}
            rel="noreferrer"
            onClick={(event) => {
              if (g.id === webGame.id) {
                event.preventDefault()
                setPlaying(true)
              }
            }}
          >
            <img className="gv__cover" src={g.cover} alt={g.name} loading="lazy" />
            <span className="gv__name">{g.name}</span>
            {g.id === webGame.id && <span className="gv__play-label">点击开始体验 ↗</span>}
          </a>
        ))}
      </div>
      <p className="gv__hint">
        <span className="gv__hint-label">提示</span>
        《画外的一笔》可直接点击体验。其余两款为 Windows 游戏，请从本地文件夹启动：
        {localGames.map((g) => (
          <code key={g.id}>{g.url.replace('file:///', '').replaceAll('/', '\\')}</code>
        ))}
      </p>
    </div>
  )
}
