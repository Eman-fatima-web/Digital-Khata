type CountUpOptions = {
  duration?: number
  decimals?: number
}

export function useCountUp(
  target: number,
  { decimals = 0 }: CountUpOptions = {},
): number {
  return Number(target.toFixed(decimals))
}
