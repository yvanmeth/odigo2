type AvatarDirection = 'up' | 'down' | 'left' | 'right'

interface OdigoAvatarProps {
  direction?: AvatarDirection
  size?: number
  style?: React.CSSProperties
}

const AVATAR_SRC: Record<AvatarDirection, string> = {
  up:    '/odigo-avatar.svg',
  down:  '/odigo-avatar-down.svg',
  left:  '/odigo-avatar-left.svg',
  right: '/odigo-avatar-right.svg',
}

export const OdigoAvatar = ({
  direction = 'up',
  size = 32,
  style
}: OdigoAvatarProps) => (
  <img
    src={AVATAR_SRC[direction]}
    alt="Odigo"
    style={{ width: size, height: size, ...style }}
  />
)
