// Adapted from shadcn/ui (https://ui.shadcn.com/docs/components/toast)
import { Toast, ToastActionElement, ToastProps } from "@/features/ui/components/toast"
import {
  ToastProvider,
  ToastViewport,
} from "@/features/ui/components/toast"
import { useToast as useToastLib } from "@/features/ui/components/toast"

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

export const useToast = useToastLib

