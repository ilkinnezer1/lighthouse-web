export type AuditTone = 'create' | 'update' | 'delete' | 'auth' | 'neutral'

// The action is a dotted string like `projects.create` / `auth.login`; tone is
// driven by the verb (last segment) so unknown actions still get a sane color.
export function actionTone(action: string): AuditTone {
  const verb = action.split('.').pop() ?? action
  if (/^(create|provision|deploy|redeploy|restore|start)/.test(verb)) return 'create'
  if (/^(update|patch|set|rename|rollback|restart|cancel|stop)/.test(verb)) return 'update'
  if (/^(delete|destroy|teardown|drop|remove)/.test(verb)) return 'delete'
  if (/^(login|logout|signup)/.test(verb) || action.startsWith('auth.')) return 'auth'
  return 'neutral'
}

export const actionBadgeClass: Record<AuditTone, string> = {
  create: 'bg-success/10 text-success ring-1 ring-inset ring-success/20',
  update: 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20',
  delete: 'bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20',
  auth: 'bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20',
  neutral: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
}

// Build an in-app route to the referenced resource when we can name one.
export function resourceRoute(
  resourceType: string | null,
  resourceId: string | null,
): string | null {
  if (!resourceType || !resourceId) return null
  switch (resourceType) {
    case 'projects':
      return `/projects/${resourceId}`
    case 'deployments':
      return `/deployments/${resourceId}`
    default:
      return null
  }
}

export function shortId(id: string | null): string | null {
  if (!id) return null
  return id.length > 8 ? id.slice(0, 8) : id
}
