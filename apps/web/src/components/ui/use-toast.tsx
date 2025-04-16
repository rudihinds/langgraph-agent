// Adapted from shadcn/ui (https://ui.shadcn.com/docs/components/toast)
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast"
import {
  ToastProvider,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast as useToastLib } from "@/components/ui/toast"

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

export const useToast = useToastLib

