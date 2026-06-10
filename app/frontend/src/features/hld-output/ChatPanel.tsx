import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, HLDDocument, HLDEditCommand } from '@/types'
import { streamChat, ApiError } from '@/api/client'
import { Send, Sparkles, User, Loader2 } from 'lucide-react'
import styles from './ChatPanel.module.css'

// Strip the HLD_EDIT marker from the displayed text
const EDIT_MARKER_RE = /<!--\s*HLD_EDIT:[\s\S]*?-->/gi

interface ChatPanelProps {
  hld: HLDDocument
  onEdit?: (cmd: HLDEditCommand) => void
}

export function ChatPanel({ hld, onEdit }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I've reviewed the **${hld.project_name}** HLD. Ask me to explain any section, challenge a decision, or apply changes.\n\nFor example: *"Why did we choose this caching strategy?"*, *"What are the risks in Section 3?"*, or *"Rename section 1.2 to Performance Goals."*`,
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')
    setStreaming(true)

    abortRef.current = new AbortController()
    let assistantContent = ''

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      await streamChat(
        hld,
        history,
        text,
        (token) => {
          assistantContent += token
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
            return updated
          })
        },
        (edit) => {
          // Strip edit marker from displayed text; attach edit metadata
          const cleanContent = assistantContent.replace(EDIT_MARKER_RE, '').trim()
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: cleanContent,
              edit: edit ?? undefined,
            }
            return updated
          })
          if (edit) onEdit?.(edit)
          setStreaming(false)
        },
        abortRef.current.signal,
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      const msg = err instanceof ApiError ? err.detail : 'Failed to get a response'
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `⚠️ ${msg}` }
        return updated
      })
      setStreaming(false)
    }
  }, [hld, input, messages, onEdit, streaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={styles.panel}>
      {/* Project context box — matches design's ctx-aside */}
      <div className={styles.ctxBox}>
        <p className={styles.ctxLabel}>Project Context</p>
        <div className={styles.ctxProject}>
          <p className={styles.ctxProjectLabel}>Architecture Document</p>
          <p className={styles.ctxProjectName}>{hld.project_name}</p>
        </div>
      </div>

      <div className={styles.header}>
        <Sparkles size={15} className={styles.headerIcon} />
        <span className={styles.headerTitle}>Architecture Sidekick</span>
      </div>

      <div className={styles.messages} aria-live="polite" aria-label="Chat messages">
        {messages.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className={styles.typing}>
            <Loader2 size={14} className={styles.typingIcon} />
            <span>Thinking…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          rows={1}
          placeholder="Ask about any section or decision…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          aria-label="Chat input"
        />
        <button
          className={styles.sendBtn}
          onClick={send}
          disabled={!input.trim() || streaming}
          aria-label="Send message"
        >
          {streaming ? <Loader2 size={16} className={styles.sendSpinner} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}

function editLabel(cmd: HLDEditCommand): string {
  if (cmd.type === 'update_section') {
    return cmd.title
      ? `Section "${cmd.key}" renamed and updated`
      : `Section "${cmd.key}" updated`
  }
  if (cmd.type === 'update_adr') return `ADR ${cmd.id} — ${cmd.field} updated`
  return 'Document updated'
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}>
      <span className={styles.bubbleIcon} aria-hidden="true">
        {isUser ? <User size={13} /> : <Sparkles size={13} />}
      </span>
      <div className={styles.bubbleContent}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
        {message.edit && (
          <div className={styles.editApplied}>
            <span className={styles.editAppliedDot} />
            Applied — {editLabel(message.edit)}
          </div>
        )}
      </div>
    </div>
  )
}
