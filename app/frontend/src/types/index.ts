// All shared TypeScript types — mirroring the backend domain models.

export type HLDTemplate = 'arc42' | 'c4-adr' | 'rfc-design-doc' | 'custom'
export type DiagramLevel = 'context' | 'container' | 'component'
export type MessageRole = 'user' | 'assistant'

export interface HLDSection {
  key: string
  number: string
  title: string
  content: string
  reviewer: string | null
}

export interface ADRAlternative {
  option: string
  pros: string[]
  cons: string[]
}

export interface ADR {
  id: string
  title: string
  status: string
  context: string
  decision: string
  alternatives: ADRAlternative[]
  consequences_positive: string[]
  consequences_negative: string[]
  cost_band: '$' | '$$' | '$$$'
}

export interface C4Diagram {
  level: DiagramLevel
  mermaid_syntax: string
}

export interface HLDDocument {
  project_name: string
  template: HLDTemplate
  sections: HLDSection[]
  adrs: ADR[]
  diagrams: C4Diagram[]
}

export interface ChatMessage {
  role: MessageRole
  content: string
}

/**
 * A single HLD section with an optional hint that gets forwarded to
 * the LLM as guidance for what to write in that section.
 */
export interface Section {
  name: string
  hint: string   // empty string when the user hasn't provided one
}

export interface TemplateOption {
  id: HLDTemplate
  name: string
  standard: string
  description: string
  section_count: number
  good_for: string[]
  /** Default section list used to pre-populate the custom editor */
  default_sections?: string[]
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: 'arc42',
    name: 'arc42',
    standard: 'arc42 v9 (July 2025)',
    description: 'The most widely adopted enterprise standard — 12 structured sections from context to glossary.',
    section_count: 12,
    good_for: ['Enterprise', 'Regulated industries', 'Consulting delivery'],
    default_sections: [
      'Introduction and Goals', 'Architecture Constraints', 'Context and Scope',
      'Solution Strategy', 'Building Block View', 'Runtime View', 'Deployment View',
      'Cross-cutting Concepts', 'Architecture Decisions', 'Quality Requirements',
      'Risks and Technical Debt', 'Glossary',
    ],
  },
  {
    id: 'c4-adr',
    name: 'C4 + ADR',
    standard: 'C4 Model + Michael Nygard ADR',
    description: 'Lightweight modern format — context → containers → components, with one ADR per major decision.',
    section_count: 6,
    good_for: ['Product engineering', 'Microservices', 'Modern teams'],
    default_sections: [
      'System Overview', 'C4 Context — System and Actors', 'C4 Container — Services and Data Stores',
      'C4 Component — Internal Structure', 'Architecture Decision Records', 'Risks and Open Questions',
    ],
  },
  {
    id: 'rfc-design-doc',
    name: 'RFC / Design Doc',
    standard: 'Google Design Doc (2024)',
    description: 'Used at Google, Stripe, and Amazon — forces explicit problem framing and alternatives before implementation.',
    section_count: 8,
    good_for: ['Product & platform teams', 'Pre-implementation alignment', 'Staff+ engineers'],
    default_sections: [
      'TL;DR', 'Context & Scope', 'Goals and Non-Goals', 'Technical Design',
      'Alternatives Considered', 'Cross-cutting Concerns', 'Risks', 'Rollout Plan',
    ],
  },
]
