// Sigil generation types

export interface SigilVibeAnalysis {
  dominantVibe: string // "warrior", "sage", "mystic", "guardian", "seeker", "creator", "healer"
  traits: string[] // ["determined", "intuitive", "grounded"]
  runeAffinity: 'elder_futhark' | 'younger_futhark' | 'anglo_saxon' | 'mystical'
  description: string // poetic one-sentence description (max 100 chars)
}

export interface SigilInput {
  name: string
  bio?: string
  userPhoto?: string // base64
  aspectRatio?: string
  style?: SigilStyle
}

export interface SigilGenerationRecord {
  id: number
  orderId: string
  name: string
  bio?: string
  userPhoto?: string
  vibeAnalysis?: SigilVibeAnalysis
  generatedImage: string
  prompt?: string
  aspectRatio: string
  status: 'pending' | 'generating' | 'completed' | 'failed'
  votes: number
  userId?: string
  createdAt: string
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9'

export const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: '1:1', label: '1:1' },
  { id: '3:4', label: '3:4' },
  { id: '4:3', label: '4:3' },
  { id: '9:16', label: '9:16' },
  { id: '16:9', label: '16:9' },
]

// Sigil generation style
export type SigilStyle = 'rune' | 'totem'

export const SIGIL_STYLES: { id: SigilStyle; label: string; labelZh: string; desc: string; descZh: string }[] = [
  {
    id: 'totem',
    label: 'Life Totem',
    labelZh: '生命图腾',
    desc: 'Minimalist B&W totem with zen koan',
    descZh: '极简黑白图腾，配禅意公案',
  },
  {
    id: 'rune',
    label: 'Mystical Rune',
    labelZh: '神秘符文',
    desc: 'Golden rune sigil with ethereal glow',
    descZh: '金色符文印记，带有空灵光芒',
  },
]
