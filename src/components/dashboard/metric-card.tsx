import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: "up" | "down" | "neutral"
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = "neutral",
  className,
}: MetricCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border rounded-lg p-5 flex flex-col gap-4",
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {subtitle && (
          <p className={cn(
            "text-xs mt-1",
            trend === "up" && "text-primary",
            trend === "down" && "text-destructive",
            trend === "neutral" && "text-muted-foreground",
          )}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
