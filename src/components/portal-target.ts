import {
  defineComponent,
  PropType,
  h,
  resolveComponent,
  FunctionalComponent,
  ComponentOptions,
  ComponentInternalInstance,
  getCurrentInstance,
  computed,
  watch,
  VNode,
} from 'vue'
import { useWormhole } from '@/composables/wormhole'

type TransitionComponent = PropType<
  ComponentOptions<any> | FunctionalComponent | string
>

export const PortalTargetContent: FunctionalComponent = (_, { slots }) => {
  return slots.default?.()
}

export default defineComponent({
  name: 'portalTarget',
  props: {
    multiple: { type: Boolean, default: false },
    name: { type: String, required: true },
    slotProps: { type: Object, default: () => ({}) },
    __parent: {
      type: Object as PropType<ComponentInternalInstance>,
    },
  },
  setup(props, { emit, slots }) {
    // TODO: validate if parent injection works
    // depends on MountingPortalTarget
    if (props.__parent) {
      useParentInjector(props.__parent)
    }

    const wormhole = useWormhole()

    const slotVnodes = computed<{ vnodes: VNode[]; vnodesFn: () => VNode[] }>(
      () => {
        const transports = wormhole.getContentForTarget(props.name)
        const wrapperSlot = slots.wrapper
        const rawNodes = transports.map((t) => t.content(props.slotProps))
        const vnodes = wrapperSlot
          ? rawNodes.flatMap((nodes) =>
              nodes.length ? wrapperSlot(nodes) : []
            )
          : rawNodes.flat(1)
        return {
          vnodes,
          vnodesFn: () => vnodes, // just to make Vue happy. raw vnodes in a slot give a DEV warning
        }
      }
    )

    watch(slotVnodes, ({ vnodes }) => {
      const hasContent = vnodes.length > 0
      const content = wormhole.transports.get(props.name)
      const sources = content ? [...content.keys()] : []
      emit('change', { hasContent, sources })
    })

    return () => {
      const hasContent = !!slotVnodes.value.vnodes.length
      if (hasContent) {
        return h(PortalTargetContent, slotVnodes.value.vnodesFn)
      } else {
        slots.default?.()
      }
    }
  },
})

function useParentInjector(parent: ComponentInternalInstance) {
  const vm = getCurrentInstance()
  vm!.parent = parent
}