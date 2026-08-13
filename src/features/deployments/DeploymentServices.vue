<script setup lang="ts">
import { ref } from 'vue'
import { Globe, LoaderCircle, Play, RotateCw, Square, SquareTerminal } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useServiceAction } from './deployments.queries'
import type { ServiceAction } from './deployments.api'
import type { Service } from '@/types/api'
import type { HealthTone } from './serviceHealth'
import { isServiceDown, type ServiceTones } from './serviceTones'
import ServiceHealthBadge from './ServiceHealthBadge.vue'
import ServiceStatsReadout from './ServiceStatsReadout.vue'
import ServiceTerminal from './ServiceTerminal.vue'
import { apiErrorMessage } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const props = defineProps<{ deploymentId: string; services: Service[]; tones: ServiceTones }>()
const emit = defineEmits<{ tone: [name: string, tone: HealthTone] }>()

const svcAction = useServiceAction(() => props.deploymentId)
const busyService = ref<string | null>(null)

const serviceDown = (svc: Service) => isServiceDown(props.tones, svc)

const actionVerb: Record<ServiceAction, string> = {
  start: 'started',
  stop: 'stopped',
  restart: 'restarted',
}

async function onServiceAction(name: string, action: ServiceAction) {
  busyService.value = name
  try {
    await svcAction.mutateAsync({ name, action })
    toast.success(`${name} ${actionVerb[action]}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, `Could not ${action} ${name}`))
  } finally {
    busyService.value = null
  }
}

const terminalOpen = ref(false)
const terminalService = ref<string | undefined>(undefined)

function onCli(name: string) {
  terminalService.value = name
  terminalOpen.value = true
}
</script>

<template>
  <section v-if="services.length" class="mt-6">
    <h2 class="text-sm font-semibold tracking-tight text-foreground">Services</h2>
    <div class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
      <div
        v-for="svc in services"
        :key="svc.id"
        class="flex items-center justify-between gap-3 px-4 py-2.5"
        :class="
          svc.isWeb && serviceDown(svc)
            ? 'bg-destructive/5'
            : svc.isWeb
              ? 'bg-primary/[0.04]'
              : 'bg-card'
        "
      >
        <div class="flex min-w-0 items-center gap-2">
          <ServiceHealthBadge
            :deployment-id="deploymentId"
            :service="svc.name"
            :is-web="svc.isWeb"
            :db-status="svc.status"
            :has-container="!!svc.containerId"
            :port="svc.port"
            @tone="(t) => emit('tone', svc.name, t)"
          >
            {{ svc.name }}
            <template #after-name>
              <Badge v-if="svc.isWeb" variant="default" class="shrink-0 gap-1">
                <Globe class="size-3" />
                web
              </Badge>
            </template>
          </ServiceHealthBadge>
          <ServiceStatsReadout
            v-if="svc.status === 'running'"
            :deployment-id="deploymentId"
            :service="svc.name"
            :enabled="svc.status === 'running'"
          />
        </div>
        <div class="flex shrink-0 items-center gap-0.5">
          <template v-if="svc.status === 'running'">
            <AlertDialog v-if="svc.isWeb">
              <AlertDialogTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Stop (takes the site offline)"
                  class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  :disabled="busyService === svc.name"
                >
                  <Square />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop the web service?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{{ svc.name }}” serves this deployment — stopping it takes the site offline
                    until you start it again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-white hover:bg-destructive/90"
                    :disabled="busyService === svc.name"
                    @click="onServiceAction(svc.name, 'stop')"
                  >
                    <LoaderCircle v-if="busyService === svc.name" class="animate-spin" />
                    Take offline
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              v-else
              variant="ghost"
              size="icon-sm"
              title="Stop"
              class="text-destructive hover:bg-destructive/10 hover:text-destructive"
              :disabled="busyService === svc.name"
              @click="onServiceAction(svc.name, 'stop')"
            >
              <Square />
            </Button>
          </template>
          <Button
            v-else
            variant="ghost"
            size="icon-sm"
            :title="svc.isWeb ? 'Start (brings the site back)' : 'Start'"
            class="text-success hover:bg-success/10 hover:text-success"
            :disabled="busyService === svc.name"
            @click="onServiceAction(svc.name, 'start')"
          >
            <Play />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Restart"
            class="text-primary hover:bg-primary/10 hover:text-primary"
            :disabled="busyService === svc.name"
            @click="onServiceAction(svc.name, 'restart')"
          >
            <RotateCw :class="busyService === svc.name && 'animate-spin'" />
          </Button>
          <Button
            v-if="svc.status === 'running'"
            variant="ghost"
            size="icon-sm"
            title="Open terminal"
            class="text-muted-foreground hover:bg-primary/10 hover:text-primary"
            @click="onCli(svc.name)"
          >
            <SquareTerminal />
          </Button>
        </div>
      </div>
    </div>

    <ServiceTerminal
      v-model:open="terminalOpen"
      :deployment-id="deploymentId"
      :service="terminalService"
    />
  </section>
</template>
