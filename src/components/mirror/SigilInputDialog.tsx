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
  DialogFooter,
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
  const [selectedStyle, setSelectedStyle] = useState<SigilStyle>('rune')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setBio(defaultBio)
      setSelectedRatio(defaultRatio)
      setSelectedStyle('rune')
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
      <DialogContent className="sm:max-w-[400px] max-h-[85vh] overflow-y-auto bg-[#0D1B2A] border-[#C9A227]/30 text-white">
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
          {/* User Photo Preview */}
          {userPhoto && (
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#C9A227]/50 bg-black/30 shadow-lg shadow-[#00D4FF]/20">
                  <img src={userPhoto} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#0D1B2A] border-2 border-[#C9A227]/50 flex items-center justify-center">
                  <User className="w-4 h-4 text-[#C9A227]" />
                </div>
              </div>
            </div>
          )}

          {/* Name Input */}
          <div className="space-y-2">
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
            <p className="text-xs text-white/40 text-right">{name.length}/50</p>
          </div>

          {/* Bio Input */}
          <div className="space-y-2">
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
            <p className="text-xs text-white/40 text-right">{bio.length}/200</p>
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              {t('select_style') || 'Style'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SIGIL_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-all text-left',
                    selectedStyle === style.id
                      ? 'border-[#C9A227] bg-[#C9A227]/10'
                      : 'border-white/20 hover:border-white/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm font-medium',
                      selectedStyle === style.id ? 'text-[#C9A227]' : 'text-white/80',
                    )}>
                      {style.labelZh}
                    </span>
                    {selectedStyle === style.id && (
                      <Check className="w-3 h-3 text-[#C9A227]" />
                    )}
                  </div>
                  <p className="text-xs text-white/50 mt-1">{style.descZh}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              {t('select_ratio')}
            </label>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => setSelectedRatio(ratio.id)}
                  className={cn(
                    'flex-1 px-2 py-1.5 rounded-md border-2 transition-all text-xs font-medium',
                    selectedRatio === ratio.id
                      ? 'border-[#C9A227] bg-[#C9A227]/20 text-[#C9A227]'
                      : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white/80',
                  )}
                >
                  {ratio.label}
                  {selectedRatio === ratio.id && (
                    <Check className="w-3 h-3 ml-1 inline-block" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Credits Info / Login Prompt */}
        <div className="border-t border-white/10 pt-3 mt-2">
          {authLoading ? (
            <div className="flex items-center justify-center py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#C9A227] border-t-transparent" />
            </div>
          ) : !isLoggedIn ? (
            <div className="text-center space-y-2">
              <p className="text-white/60 text-xs">{t('login_required')}</p>
              <Button
                type="button"
                size="sm"
                onClick={() => signInWithGoogle()}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                {t('sign_in_to_generate')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-white/60">
                <Coins className="w-4 h-4 text-[#C9A227]" />
                <span>
                  {t('your_credits')}: <span className="text-[#C9A227] font-medium">{credits}</span>
                </span>
              </div>
              <div className={cn(
                'text-xs px-2 py-0.5 rounded',
                hasEnoughCredits ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400',
              )}>
                {t('cost')}: {SIGIL_CREDITS}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-2">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
