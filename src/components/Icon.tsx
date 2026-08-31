interface IconProps {
  name: string
  size?: number
  color?: string
}

const PATHS: Record<string, string> = {
  clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 7v5l3.5 2',
  snail: 'M4 16a6 6 0 0112 0v2H4v-2zM16 14a3 3 0 100-6 3 3 0 000 6zM3 20h18M7 9l1.5-3M11 8l1-2.5',
  shield: 'M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5l8-3z',
  star: 'M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.6 19.7l1.2-6.1L3.3 9.4l6.1-.8L12 3z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  gem: 'M6 3h12l4 6-10 12L2 9l4-6zM2 9h20M9 3l3 18M15 3l-3 18',
  home: 'M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5',
  flag: 'M5 21V4M5 4h11l-1.5 4L16 12H5',
  bag: 'M6 7h12l1 13H5L6 7zM9 7V5a3 3 0 016 0v2',
  shop: 'M3 5h18l-1.5 13H4.5L3 5zM9 9V4h6v5M9 9h6',
  speaker: 'M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7',
  book: 'M4 4h7a2 2 0 012 2v14a2 2 0 00-2-2H4V4zM20 4h-7a2 2 0 00-2 2v14a2 2 0 012-2h7V4z',
  check: 'M4 12l5 5L20 6',
  lock: 'M6 11h12v9H6v-9zM9 11V7a3 3 0 016 0v4',
  coin: 'M12 2a10 10 0 100 20 10 10 0 000-20zM9 9h6M9 13h6M12 9v8',
}

export function Icon({ name, size = 22, color = 'currentColor' }: IconProps) {
  const d = PATHS[name] ?? PATHS.star
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
