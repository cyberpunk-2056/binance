'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CurrencyContext = createContext(null);

export const CURRENCIES = [
  { code: 'USD', symbol: '$',    label: 'USD-$' },
  { code: 'INR', symbol: '₹',   label: 'INR-₹' },
  { code: 'AED', symbol: 'د.إ', label: 'AED-د.إ' },
  { code: 'ARS', symbol: 'ARS$',label: 'ARS-ARS$' },
  { code: 'AUD', symbol: 'A$',  label: 'AUD-A$' },
  { code: 'AZN', symbol: '₼',   label: 'AZN-₼' },
  { code: 'BDT', symbol: '৳',   label: 'BDT-৳' },
  { code: 'BGN', symbol: 'лв',  label: 'BGN-лв' },
  { code: 'BHD', symbol: '.د.ب',label: 'BHD-.د.ب' },
  { code: 'BRL', symbol: 'R$',  label: 'BRL-R$' },
  { code: 'CAD', symbol: 'C$',  label: 'CAD-C$' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF-CHF' },
  { code: 'CLP', symbol: 'CLP$',label: 'CLP-CLP$' },
  { code: 'CNY', symbol: '¥',   label: 'CNY-¥' },
  { code: 'COP', symbol: 'COP$',label: 'COP-COP$' },
  { code: 'CZK', symbol: 'Kč',  label: 'CZK-Kč' },
  { code: 'DKK', symbol: 'kr',  label: 'DKK-kr' },
  { code: 'EGP', symbol: '£',   label: 'EGP-E£' },
  { code: 'EUR', symbol: '€',   label: 'EUR-€' },
  { code: 'GBP', symbol: '£',   label: 'GBP-£' },
  { code: 'GEL', symbol: '₾',   label: 'GEL-₾' },
  { code: 'GHS', symbol: '₵',   label: 'GHS-₵' },
  { code: 'HKD', symbol: 'HK$', label: 'HKD-HK$' },
  { code: 'HUF', symbol: 'Ft',  label: 'HUF-Ft' },
  { code: 'IDR', symbol: 'Rp',  label: 'IDR-Rp' },
  { code: 'ILS', symbol: '₪',   label: 'ILS-₪' },
  { code: 'JPY', symbol: '¥',   label: 'JPY-¥' },
  { code: 'KES', symbol: 'KSh', label: 'KES-KSh' },
  { code: 'KRW', symbol: '₩',   label: 'KRW-₩' },
  { code: 'KWD', symbol: 'د.ك', label: 'KWD-د.ك' },
  { code: 'KZT', symbol: '₸',   label: 'KZT-₸' },
  { code: 'MXN', symbol: 'MX$', label: 'MXN-MX$' },
  { code: 'MYR', symbol: 'RM',  label: 'MYR-RM' },
  { code: 'NGN', symbol: '₦',   label: 'NGN-₦' },
  { code: 'NOK', symbol: 'kr',  label: 'NOK-kr' },
  { code: 'NZD', symbol: 'NZ$', label: 'NZD-NZ$' },
  { code: 'PHP', symbol: '₱',   label: 'PHP-₱' },
  { code: 'PKR', symbol: '₨',   label: 'PKR-₨' },
  { code: 'PLN', symbol: 'zł',  label: 'PLN-zł' },
  { code: 'RON', symbol: 'lei', label: 'RON-lei' },
  { code: 'RUB', symbol: '₽',   label: 'RUB-₽' },
  { code: 'SAR', symbol: '﷼',   label: 'SAR-﷼' },
  { code: 'SEK', symbol: 'kr',  label: 'SEK-kr' },
  { code: 'SGD', symbol: 'S$',  label: 'SGD-S$' },
  { code: 'THB', symbol: '฿',   label: 'THB-฿' },
  { code: 'TRY', symbol: '₺',   label: 'TRY-₺' },
  { code: 'TWD', symbol: 'NT$', label: 'TWD-NT$' },
  { code: 'UAH', symbol: '₴',   label: 'UAH-₴' },
  { code: 'VND', symbol: '₫',   label: 'VND-₫' },
  { code: 'ZAR', symbol: 'R',   label: 'ZAR-R' },
];

export const LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'ar',    label: 'العربية' },
  { code: 'ar-BH', label: 'العربية (البحرين)' },
  { code: 'az',    label: 'Azərbaycan' },
  { code: 'bg',    label: 'Български' },
  { code: 'cs',    label: 'Čeština' },
  { code: 'da',    label: 'Dansk' },
  { code: 'de',    label: 'Deutsch' },
  { code: 'el',    label: 'Ελληνικά' },
  { code: 'es',    label: 'Español' },
  { code: 'fa',    label: 'فارسی' },
  { code: 'fi',    label: 'Suomi' },
  { code: 'fr',    label: 'Français' },
  { code: 'he',    label: 'עברית' },
  { code: 'hi',    label: 'हिन्दी' },
  { code: 'hr',    label: 'Hrvatski' },
  { code: 'hu',    label: 'Magyar' },
  { code: 'hy',    label: 'Հայերեն' },
  { code: 'id',    label: 'Indonesia' },
  { code: 'it',    label: 'Italiano' },
  { code: 'ja',    label: '日本語' },
  { code: 'ka',    label: 'ქართული' },
  { code: 'kk',    label: 'Қазақша' },
  { code: 'ko',    label: '한국어' },
  { code: 'lt',    label: 'Lietuvių' },
  { code: 'lv',    label: 'Latviešu' },
  { code: 'mk',    label: 'Македонски' },
  { code: 'ms',    label: 'Melayu' },
  { code: 'nl',    label: 'Nederlands' },
  { code: 'no',    label: 'Norsk' },
  { code: 'pl',    label: 'Polski' },
  { code: 'pt',    label: 'Português' },
  { code: 'ro',    label: 'Română' },
  { code: 'ru',    label: 'Русский' },
  { code: 'sk',    label: 'Slovenčina' },
  { code: 'sl',    label: 'Slovenščina' },
  { code: 'sr',    label: 'Srpski' },
  { code: 'sv',    label: 'Svenska' },
  { code: 'th',    label: 'ภาษาไทย' },
  { code: 'tr',    label: 'Türkçe' },
  { code: 'uk',    label: 'Українська' },
  { code: 'uz',    label: 'Oʻzbekcha' },
  { code: 'vi',    label: 'Tiếng Việt' },
  { code: 'zh-CN', label: '中文 (简体)' },
  { code: 'zh-TW', label: '中文 (繁體)' },
];

const FALLBACK_RATES = {
  USD: 1, INR: 83.5, EUR: 0.92, GBP: 0.79, JPY: 149.5,
  AUD: 1.53, CAD: 1.36, CHF: 0.90, CNY: 7.24, KRW: 1320,
  SGD: 1.34, HKD: 7.82, BRL: 5.05, MXN: 17.1, TRY: 32.1,
  AED: 3.67, SAR: 3.75, THB: 35.5, MYR: 4.7, IDR: 15700,
};

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrencyState] = useState('USD');
  const [language, setLanguageState] = useState('en-IN');
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [rateLoading, setRateLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await res.json();
      if (data?.rates) setRates(prev => ({ ...prev, ...data.rates }));
    } catch { /* use fallback */ } finally { setRateLoading(false); }
  }, []);

  useEffect(() => {
    const savedCurrency = localStorage.getItem('preferred_currency');
    const savedLanguage  = localStorage.getItem('preferred_language');
    if (savedCurrency && CURRENCIES.find(c => c.code === savedCurrency)) setCurrencyState(savedCurrency);
    if (savedLanguage  && LANGUAGES.find(l  => l.code === savedLanguage))  setLanguageState(savedLanguage);
    fetchRates();
    const interval = setInterval(fetchRates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  const setCurrency = (code) => { setCurrencyState(code); localStorage.setItem('preferred_currency', code); };
  const setLanguage = (code) => { setLanguageState(code); localStorage.setItem('preferred_language', code); };

  const getCurrencyInfo = useCallback(() =>
    CURRENCIES.find(c => c.code === currency) || CURRENCIES[0],
  [currency]);

  const convert = useCallback((usdPrice) => {
    const rate = rates[currency] || 1;
    const info = getCurrencyInfo();
    // High-value currencies (INR, JPY, KRW etc.) → 0 decimal places
    const isHigh = rate > 10;
    return { value: usdPrice * rate, symbol: info.symbol, decimals: isHigh ? 0 : (usdPrice < 1 ? 4 : 2) };
  }, [currency, rates, getCurrencyInfo]);

  const fmt = useCallback((usdPrice, opts = {}) => {
    if (usdPrice == null) return '-';
    const { value, symbol, decimals } = convert(usdPrice);
    const locale = currency === 'INR' ? 'en-IN' : 'en-US';
    const formatted = value?.toLocaleString(locale, {
      minimumFractionDigits: opts.minDecimals ?? decimals,
      maximumFractionDigits: opts.maxDecimals ?? Math.max(decimals, opts.minDecimals ?? 0),
    });
    return `${symbol}${formatted}`;
  }, [convert, currency]);

  const fmtLarge = useCallback((usdNum) => {
    if (usdNum == null) return '-';
    const { value, symbol } = convert(usdNum);
    if (value >= 1e12) return `${symbol}${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9)  return `${symbol}${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6)  return `${symbol}${(value / 1e6).toFixed(2)}M`;
    return `${symbol}${value?.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }, [convert]);

  return (
    <CurrencyContext.Provider value={{
      currency, setCurrency,
      language, setLanguage,
      rates, rateLoading,
      inrRate: rates['INR'] || 83.5, // backward compat
      convert, fmt, fmtLarge, getCurrencyInfo,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
};
