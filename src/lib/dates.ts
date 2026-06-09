export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date()
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const formatDateDMY = (dateStr: string): string => {
  const d = parseLocalDate(dateStr)
  return d.toLocaleDateString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

export const isToday = (dateStr: string): boolean => {
  const d = parseLocalDate(dateStr)
  const today = new Date()
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
}
