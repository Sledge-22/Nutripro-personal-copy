const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ",
  "EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HM","HN","HR","HT","HU",
  "ID","IE","IM","IN","IO","IQ","IR","IS","IT",
  "JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
  "OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA",
  "RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ",
  "TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","UM","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU",
  "WF","WS",
  "YE","YT",
  "ZA","ZM","ZW",
];

const displayNamesCache = new Map();
const lookupCache = new Map();
const COUNTRY_NAME_OVERRIDES = {
  en: {
    PS: "Palestine",
  },
  es: {
    PS: "Palestina",
  },
};

function getDisplayNames(language = "en") {
  if (!displayNamesCache.has(language)) {
    displayNamesCache.set(
      language,
      new Intl.DisplayNames([language], { type: "region" }),
    );
  }
  return displayNamesCache.get(language);
}

function normalizeLookupValue(value) {
  return `${value ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function countryCodeToFlag(code = "") {
  const normalizedCode = `${code ?? ""}`.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) return "";
  return String.fromCodePoint(
    ...normalizedCode.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
}

export function getCountryOptions(language = "en") {
  const names = getDisplayNames(language);
  return COUNTRY_CODES.map((code) => {
    const overrideName =
      COUNTRY_NAME_OVERRIDES[language]?.[code] ??
      COUNTRY_NAME_OVERRIDES.en?.[code];
    const name = overrideName || names.of(code) || code;
    return {
      code,
      name,
      flag: countryCodeToFlag(code),
    };
  }).sort((left, right) => left.name.localeCompare(right.name, language));
}

function buildLookup(language = "en") {
  if (lookupCache.has(language)) return lookupCache.get(language);

  const lookup = new Map();
  ["en", "es", language].forEach((locale) => {
    getCountryOptions(locale).forEach((option) => {
      lookup.set(normalizeLookupValue(option.code), option);
      lookup.set(normalizeLookupValue(option.name), option);
      lookup.set(normalizeLookupValue(`${option.flag} ${option.name}`), option);
    });
  });

  lookupCache.set(language, lookup);
  return lookup;
}

export function findCountryOption(value, language = "en") {
  const normalizedValue = normalizeLookupValue(value);
  if (!normalizedValue) return null;
  return buildLookup(language).get(normalizedValue) ?? null;
}

export function normalizeCountrySelection(selection, language = "en") {
  if (!selection) {
    return {
      country: "",
      countryCode: "",
      countryName: "",
      countryFlag: "",
    };
  }

  const option =
    typeof selection === "string"
      ? findCountryOption(selection, language)
      : findCountryOption(selection.code || selection.countryCode || selection.country || selection.name, language) ??
        selection;

  if (!option) {
    const fallbackName = typeof selection === "string" ? `${selection}`.trim() : `${selection?.country ?? selection?.name ?? ""}`.trim();
    return {
      country: fallbackName,
      countryCode: "",
      countryName: fallbackName,
      countryFlag: "",
    };
  }

  const code = `${option.code ?? option.countryCode ?? ""}`.trim().toUpperCase();
  const name = `${option.name ?? option.countryName ?? option.country ?? ""}`.trim();
  const flag = `${option.flag ?? option.countryFlag ?? countryCodeToFlag(code)}`.trim();

  return {
    country: name,
    countryCode: code,
    countryName: name,
    countryFlag: flag,
  };
}
