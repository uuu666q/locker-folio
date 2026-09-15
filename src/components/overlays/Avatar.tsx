/** 工牌上的头像照片（圆形 + 白边 + 阴影由 about.css 提供） */
export default function Avatar({ className }: { className?: string }) {
  return (
    <img
      className={className}
      src="/assets/avatar/avatar.png"
      alt="个人头像"
      draggable={false}
    />
  )
}
