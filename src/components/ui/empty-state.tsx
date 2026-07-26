import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  children?: React.ReactNode // For action button(s)
  className?: string
}

/**
 * Consistent empty state for lists, tables, and content areas.
 * Usage:
 *   <EmptyState
 *     icon={Calendar}
 *     title="No hay sesiones esta semana"
 *     description="Crea una sesión de entrenamiento para empezar"
 *   >
 *     <Button>Nueva sesión</Button>
 *   </EmptyState>
 */
export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {Icon && (
        <div className="mb-4 rounded-lg bg-muted/50 p-3">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {children && (
        <div className="mt-4 flex items-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
