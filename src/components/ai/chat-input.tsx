"use client"

import { useState, useRef, KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { SendHorizontal, Loader2 } from "lucide-react"

interface ChatInputProps {
  onSend: (message: string) => void
  isLoading?: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, isLoading, disabled }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue("")
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2 items-end p-4 border-t border-border bg-card">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pregunta algo o pide que haga algo en tu servidor..."
        className="min-h-[44px] max-h-[120px] resize-none bg-input border-border text-sm"
        disabled={disabled || isLoading}
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={!value.trim() || isLoading || disabled}
        size="icon"
        className="h-11 w-11 shrink-0 bg-primary hover:bg-primary/90"
      >
        {isLoading
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <SendHorizontal className="w-4 h-4" />
        }
      </Button>
    </div>
  )
}
