import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode // For section-level actions
  className?: string
}

/**
 * Section header for dividing content within a page.
 * Usage:
 *   <SectionHeader title="Datos Generales">
 *     <Button variant="ghost" size="sm">Editar</Button>
 *   </SectionHeader>
 */
export function SectionHeader({ title, description, children, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
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
