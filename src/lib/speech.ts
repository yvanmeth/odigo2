export const detectLang = (text: string, fallback: string = 'fr-FR'): string => {
  if (/[Ͱ-Ͽ]/.test(text)) return 'el-GR'
  return fallback
}

export const speak = (text: string, fallback: string = 'fr-FR'): void => {
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = detectLang(text, fallback)
  speechSynthesis.speak(utterance)
}
