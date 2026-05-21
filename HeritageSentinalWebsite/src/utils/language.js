export const LANG_OPTIONS = [
  { label: 'English', value: 'en-US' },
  { label: 'Hindi', value: 'hi-IN' },
  { label: 'French', value: 'fr-FR' },
  { label: 'Spanish', value: 'es-ES' },
  { label: 'German', value: 'de-DE' },
  { label: 'Italian', value: 'it-IT' },
  { label: 'Portuguese', value: 'pt-PT' },
  { label: 'Russian', value: 'ru-RU' },
  { label: 'Arabic', value: 'ar-SA' },
  { label: 'Turkish', value: 'tr-TR' },
  { label: 'Japanese', value: 'ja-JP' },
  { label: 'Korean', value: 'ko-KR' },
  { label: 'Chinese (Simplified)', value: 'zh-CN' },
  { label: 'Chinese (Traditional)', value: 'zh-TW' },
  { label: 'Dutch', value: 'nl-NL' },
  { label: 'Swedish', value: 'sv-SE' },
  { label: 'Norwegian', value: 'no-NO' },
  { label: 'Polish', value: 'pl-PL' },
  { label: 'Ukrainian', value: 'uk-UA' },
  { label: 'Thai', value: 'th-TH' }
];


export function getNextLanguage(currentLang, reverse = false) {
  const currentIndex = LANG_OPTIONS.findIndex(l => l.value === currentLang);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const offset = reverse ? -1 : 1;
  const nextIndex = (safeIndex + offset + LANG_OPTIONS.length) % LANG_OPTIONS.length;
  return LANG_OPTIONS[nextIndex];
}

export function languageChangedMessage(nextLang) {
  if (nextLang === 'hi-IN') return 'भाषा हिंदी में बदल दी गई है';
  if (nextLang === 'fr-FR') return 'Langue changée en français';
  if (nextLang === 'es-ES') return 'Idioma cambiado a español';
  if (nextLang === 'de-DE') return 'Sprache auf Deutsch geändert';
  if (nextLang === 'it-IT') return 'Lingua cambiata in italiano';
  if (nextLang === 'pt-PT') return 'Idioma alterado para português';
  if (nextLang === 'ru-RU') return 'Язык изменен на русский';
  if (nextLang === 'ar-SA') return 'تم تغيير اللغة إلى العربية';
  if (nextLang === 'tr-TR') return 'Dil Türkçe olarak değiştirildi';
  if (nextLang === 'ja-JP') return '言語が日本語に変更されました';
  if (nextLang === 'ko-KR') return '언어가 한국어로 변경되었습니다';
  if (nextLang === 'zh-CN') return '语言已切换到中文（简体）';
  if (nextLang === 'zh-TW') return '語言已切換到中文（繁體）';
  if (nextLang === 'nl-NL') return 'Taal gewijzigd naar Nederlands';
  if (nextLang === 'sv-SE') return 'Språk ändrat till svenska';
  if (nextLang === 'no-NO') return 'Språk endret til norsk';
  if (nextLang === 'pl-PL') return 'Język zmieniony na polski';
  if (nextLang === 'uk-UA') return 'Мову змінено на українську';
  if (nextLang === 'th-TH') return 'เปลี่ยนภาษาเป็นไทย'; 
  return `Language changed to ${LANG_OPTIONS.find(l => l.value === nextLang)?.label || 'English'}`;
}


