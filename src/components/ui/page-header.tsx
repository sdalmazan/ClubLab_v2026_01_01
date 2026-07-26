"use client"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode // For primary action button(s)
  className?: string
}

/**
 * Standardized page header with title, optional description, and action slot.
 * Usage:
 *   <PageHeader title="Jugadores" description="Gestión de la plantilla">
 *     <Button>Añadir jugador</Button>
 *   </PageHeader>
 */
export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
