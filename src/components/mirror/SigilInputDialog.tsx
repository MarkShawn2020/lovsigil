'use client'

import { Check, Coins, LogIn, Sparkles, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import type { AspectRatio, SigilStyle } from './sigilTypes'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'
import { ASPECT_RATIOS, SIGIL_STYLES } from './sigilTypes'

export interface SigilInput {
  name: string
  bio: string
  aspectRatio: AspectRatio
  style: SigilStyle
}

interface SigilInputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (input: SigilInput) => void
  userPhoto?: string
  defaultRatio?: AspectRatio
  defaultBio?: string
}

// Credits cost: 2 per sigil
const SIGIL_CREDITS = 2

export function SigilInputDialog({
  open,
  onOpenChange,
  onConfirm,
  userPhoto,
  defaultRatio = '1:1',
  defaultBio = '',
}: SigilInputDialogProps) {
  const t = useTranslations('Sigil')
  const { user, credits, signInWithGoogle, loading: authLoading } = useAuth()
  const [name, setName] = useState('')
  const [bio, setBio] = useState(defaultBio)
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>(defaultRatio)
  const [selectedStyle, setSelectedStyle] = useState<SigilStyle>('totem')

  // Load persisted preferences from localStorage
  useEffect(() => {
    const savedStyle = localStorage.getItem('sigil_style') as SigilStyle | null
    const savedRatio = localStorage.getItem('sigil_ratio') as AspectRatio | null
    if (savedStyle && SIGIL_STYLES.some(s => s.id === savedStyle)) {
      setSelectedStyle(savedStyle)
    }
    if (savedRatio && ASPECT_RATIOS.some(r => r.id === savedRatio)) {
      setSelectedRatio(savedRatio)
    }
  }, [])

  // Persist style preference
  const handleStyleChange = (style: SigilStyle) => {
    setSelectedStyle(style)
    localStorage.setItem('sigil_style', style)
  }

  // Persist ratio preference
  const handleRatioChange = (ratio: AspectRatio) => {
    setSelectedRatio(ratio)
    localStorage.setItem('sigil_ratio', ratio)
  }

  // Reset form when dialog opens (keep persisted style/ratio)
  useEffect(() => {
    if (open) {
      setName('')
      setBio(defaultBio)
      // Only reset ratio if no persisted value
      if (!localStorage.getItem('sigil_ratio')) {
        setSelectedRatio(defaultRatio)
      }
    }
  }, [open, defaultRatio, defaultBio])

  const hasEnoughCredits = credits >= SIGIL_CREDITS
  const isLoggedIn = !!user
  const isNameValid = name.trim().length > 0 && name.trim().length <= 50

  const handleConfirm = () => {
    if (!isNameValid) return
    onConfirm({
      name: name.trim(),
      bio: bio.trim(),
      aspectRatio: selectedRatio,
      style: selectedStyle,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto bg-[#0D1B2A] border-[#C9A227]/30 text-white">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-[#C9A227] flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4" />
            {t('create_sigil_title')}
          </DialogTitle>
          <DialogDescription className="text-white/60 text-xs">
            {t('create_sigil_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 头像 + 昵称同行 */}
          <div className="flex items-center gap-4">
            {userPhoto && (
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#C9A227]/50 bg-black/30">
                  <img src={userPhoto} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#0D1B2A] border border-[#C9A227]/50 flex items-center justify-center">
                  <User className="w-2.5 h-2.5 text-[#C9A227]" />
                </div>
              </div>
            )}
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium text-white/80 flex items-center gap-1">
                {t('your_name')}
                <span className="text-red-400">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('name_placeholder')}
                maxLength={50}
                className="bg-black/30 border-white/20 text-white placeholder:text-white/40 focus:border-[#C9A227]/50 focus:ring-[#C9A227]/20"
              />
            </div>
          </div>

          {/* 简介 */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-white/80">
              {t('your_bio')}
            </label>
            <Input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('bio_placeholder')}
              maxLength={200}
              className="bg-black/30 border-white/20 text-white placeholder:text-white/40 focus:border-[#C9A227]/50 focus:ring-[#C9A227]/20"
            />
          </div>

          {/* 风格选择 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">
              {t('select_style') || 'Style'}
            </label>
            <div className="flex gap-2">
              {SIGIL_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleStyleChange(style.id)}
                  className={cn(
                    'flex-1 py-2 rounded-lg border-2 transition-all text-center',
                    selectedStyle === style.id
                      ? 'border-[#C9A227] bg-[#C9A227]/10'
                      : 'border-white/20 hover:border-white/40',
                  )}
                >
                  <span className={cn(
                    'text-sm font-medium',
                    selectedStyle === style.id ? 'text-[#C9A227]' : 'text-white/80',
                  )}>
                    {style.labelZh}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 比例选择 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">
              {t('select_ratio')}
            </label>
            <div className="flex gap-1.5">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => handleRatioChange(ratio.id)}
                  className={cn(
                    'flex-1 py-1.5 rounded border-2 transition-all text-xs font-medium',
                    selectedRatio === ratio.id
                      ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#C9A227]'
                      : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white/80',
                  )}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 底部：积分 + 按钮 */}
        <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-1">
          <div>
            {authLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#C9A227] border-t-transparent" />
            ) : !isLoggedIn ? (
              <Button
                type="button"
                size="sm"
                onClick={() => signInWithGoogle()}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                {t('sign_in_to_generate')}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Coins className="w-4 h-4 text-[#C9A227]" />
                <span className="text-white/60">
                  <span className="text-[#C9A227] font-medium">{credits}</span>
                </span>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  hasEnoughCredits ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400',
                )}>
                  -{SIGIL_CREDITS}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={!isLoggedIn || !hasEnoughCredits || !isNameValid}
              className={cn(
                'text-white',
                isLoggedIn && hasEnoughCredits && isNameValid
                  ? 'bg-gradient-to-r from-[#C9A227] to-[#00D4FF] hover:brightness-110'
                  : 'bg-white/20 cursor-not-allowed',
              )}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              {!isLoggedIn
                ? t('login_first')
                : !hasEnoughCredits
                  ? t('insufficient_credits')
                  : !isNameValid
                    ? t('enter_name')
                    : t('generate_sigil')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
