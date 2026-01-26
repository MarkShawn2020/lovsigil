'use client'

import { Check, Coins, Image as ImageIcon, LogIn, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/AuthProvider'

// Style definitions with preview images
export const GENERATION_STYLES = [
  {
    id: 'mural',
    nameKey: 'style_mural',
    descKey: 'style_mural_desc',
    preview: '/styles/lanna-mural.svg',
    promptModifier: 'traditional Lanna temple mural art style, rich gold leaf accents, Thai Buddhist artistic elements, warm earth tones',
  },
  {
    id: 'cute',
    nameKey: 'style_cute',
    descKey: 'style_cute_desc',
    preview: '/styles/lanna-cute.svg',
    promptModifier: 'cute chibi art style, adorable round features, kawaii aesthetic with Lanna cultural elements, soft pastel colors with gold accents',
  },
  {
    id: 'mysterious',
    nameKey: 'style_mysterious',
    descKey: 'style_mysterious_desc',
    preview: '/styles/lanna-mysterious.svg',
    promptModifier: 'dark mystical art style, ethereal glowing spirits, deep shadows with golden light, mysterious ancient Lanna atmosphere',
  },
  {
    id: 'modern',
    nameKey: 'style_modern',
    descKey: 'style_modern_desc',
    preview: '/styles/lanna-modern.svg',
    promptModifier: 'modern digital art style, clean lines, contemporary interpretation of Lanna mythology, vibrant colors with traditional elements',
  },
] as const

export type GenerationStyle = (typeof GENERATION_STYLES)[number]['id']

// Aspect ratio options
export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', width: 1024, height: 1024 },
  { id: '3:4', label: '3:4', width: 768, height: 1024 },
  { id: '4:3', label: '4:3', width: 1024, height: 768 },
  { id: '9:16', label: '9:16', width: 576, height: 1024 },
  { id: '16:9', label: '16:9', width: 1024, height: 576 },
] as const

export type AspectRatio = (typeof ASPECT_RATIOS)[number]['id']

export interface GenerationOptions {
  style: GenerationStyle
  aspectRatio: AspectRatio
}

interface GenerationOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (options: GenerationOptions) => void
  personName?: string
  personCount?: number
  userPhoto?: string
  userPhotos?: string[]
}

// 计算生成所需积分
function calculateCredits(personCount: number): number {
  // 单人 2 credits，合照 2 * n credits
  return personCount <= 1 ? 2 : 2 * personCount
}

export function GenerationOptionsDialog({
  open,
  onOpenChange,
  onConfirm,
  personName,
  personCount = 1,
  userPhoto,
  userPhotos,
}: GenerationOptionsDialogProps) {
  const t = useTranslations('LannaMirror')
  const { user, credits, signInWithGoogle, loading: authLoading } = useAuth()
  const [selectedStyle, setSelectedStyle] = useState<GenerationStyle>('mural')
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('1:1')

  const requiredCredits = calculateCredits(personCount)
  const hasEnoughCredits = credits >= requiredCredits
  const isLoggedIn = !!user

  const handleConfirm = () => {
    onConfirm({
      style: selectedStyle,
      aspectRatio: selectedRatio,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto bg-[#1a1a1a] border-[#D4AF37]/30 text-white">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-[#D4AF37] flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4" />
            {t('generation_options_title')}
          </DialogTitle>
          <DialogDescription className="text-white/60 text-xs">
            {personName
              ? t('generation_options_desc_person', { name: personName })
              : t('generation_options_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* User Photo Preview */}
          {(userPhoto || (userPhotos && userPhotos.length > 0)) && (
            <div className="flex justify-center gap-2">
              {userPhoto ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#D4AF37]/50 bg-black/30">
                  <img src={userPhoto} alt="" className="w-full h-full object-cover" />
                </div>
              ) : userPhotos ? (
                userPhotos.slice(0, 4).map((photo, idx) => (
                  <div
                    key={idx}
                    className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#D4AF37]/50 bg-black/30"
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </div>
                ))
              ) : null}
            </div>
          )}

          {/* Style Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">
              {t('select_style')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {GENERATION_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={cn(
                    'relative rounded-lg overflow-hidden border-2 transition-all',
                    selectedStyle === style.id
                      ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30'
                      : 'border-white/10 hover:border-white/30'
                  )}
                >
                  {/* Preview Image */}
                  <div className="aspect-square bg-gradient-to-br from-[#CC785C]/30 to-[#D4AF37]/30 flex items-center justify-center">
                    <div className="w-full h-full relative">
                      <img
                        src={style.preview}
                        alt={t(style.nameKey)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                      <div className="hidden absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#CC785C]/30 to-[#D4AF37]/30">
                        <ImageIcon className="w-6 h-6 text-white/40" />
                      </div>
                    </div>
                  </div>
                  {/* Label */}
                  <div className="p-1.5 bg-black/60">
                    <p className="text-xs font-medium text-white text-center truncate">{t(style.nameKey)}</p>
                  </div>
                  {/* Selected Check */}
                  {selectedStyle === style.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#D4AF37] flex items-center justify-center">
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
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
                      ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#D4AF37]'
                      : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white/80'
                  )}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Credits Info / Login Prompt */}
        <div className="border-t border-white/10 pt-3 mt-2">
          {authLoading ? (
            <div className="flex items-center justify-center py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
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
                <Coins className="w-4 h-4 text-[#D4AF37]" />
                <span>{t('your_credits')}: <span className="text-[#D4AF37] font-medium">{credits}</span></span>
              </div>
              <div className={cn(
                'text-xs px-2 py-0.5 rounded',
                hasEnoughCredits ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              )}>
                {t('cost')}: {requiredCredits}
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
            disabled={!isLoggedIn || !hasEnoughCredits}
            className={cn(
              "text-white",
              isLoggedIn && hasEnoughCredits
                ? "bg-gradient-to-r from-[#D4AF37] to-[#CC785C] hover:from-[#E5C04B] hover:to-[#DD896D]"
                : "bg-white/20 cursor-not-allowed"
            )}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            {!isLoggedIn
              ? t('login_first')
              : !hasEnoughCredits
                ? t('insufficient_credits')
                : t('generate_with_credits', { credits: requiredCredits })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
