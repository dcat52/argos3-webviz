import { cn } from "@/lib/utils"

interface SliderProps {
  className?: string
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
}

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
}: SliderProps) {
  const current = value?.[0] ?? defaultValue?.[0] ?? min

  return (
    <input
      type="range"
      className={cn("h-1 w-full cursor-pointer accent-primary", className)}
      min={min}
      max={max}
      step={step}
      value={current}
      onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
    />
  )
}

export { Slider }
