import { useTranslation } from 'react-i18next';

// Add a new language by adding an entry here + a matching locales/<code>.json file.
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
];

export default function LanguageSwitcher({ style, dark = false }) {
  const { i18n, t } = useTranslation();

  return (
    <select
      className="select"
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t('common.language')}
      style={{
        fontSize: '0.8rem',
        padding: '0.35em 0.6em',
        width: 'auto',
        ...(dark
          ? { background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }
          : {}),
        ...style,
      }}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code} style={{ color: '#000' }}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
