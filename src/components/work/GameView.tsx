import { GAMES } from '../../data/content'
import BackToFolders from './BackToFolders'
import './game.css'

/** SELECTED WORK › GAME —— 两个游戏项目（封面 + 名称，点击新标签页打开） */
export default function GameView() {
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
            target="_blank"
            rel="noreferrer"
          >
            <img className="gv__cover" src={g.cover} alt={g.name} loading="lazy" />
            <span className="gv__name">{g.name}</span>
          </a>
        ))}
      </div>
      <p className="gv__hint">
        <span className="gv__hint-label">提示</span>
        受浏览器安全策略限制，部分浏览器会拦截 file:// 本地链接；若点击后未打开，
        请手动进入游戏文件夹：
        {GAMES.map((g) => (
          <code key={g.id}>{g.url.replace('file:///', '').replaceAll('/', '\\')}</code>
        ))}
      </p>
    </div>
  )
}
