import { countryRegions, data } from './data';
let cacheEnabled = true;
function getSingleElement(code, part, language) {
    return {
        code: code,
        label: getNameFromPart(part, language),
    };
}
function getNameFromPart(part, language) {
    if (typeof part === 'string') {
        return part;
    }
    const { name } = part;
    if (typeof name === 'string') {
        return name;
    }
    if (language != null && name[language] != null) {
        return name[language];
    }
    return name.en;
}
function getRegionFromParts(parts, language) {
    let tempMap = [];
    let countryCodes = Object.keys(parts);
    for (let countryCode of countryCodes) {
        const country = parts[countryCode];
        tempMap.push(getSingleElement(countryCode, country, language));
    }
    tempMap.sort((a, b) => {
        return a.label.localeCompare(b.label);
    });
    return tempMap;
}
export function setCacheEnabled(isEnabled) {
    if (!isEnabled) {
        countryList = null;
        countryListLanguage = undefined;
    }
    cacheEnabled = isEnabled;
}
export function getSuperRegions(language) {
    let superRegions = [];
    for (const superRegionCode in data) {
        const superRegion = data[superRegionCode];
        superRegions.push(getSingleElement(superRegionCode, superRegion, language));
    }
    return superRegions;
}
export function getSuperRegion(countryCode, language) {
    for (const superRegionCode in data) {
        const superRegion = data[superRegionCode];
        if (superRegion.parts && superRegion.parts[countryCode] != null) {
            return getSingleElement(superRegionCode, superRegion, language);
        }
    }
    return null;
}
export function getCountries(superRegionCode, language) {
    if (superRegionCode == null) {
        return getCountryListAll(language);
    }
    return getCountryListBySuperRegion(superRegionCode, language);
}
let countryListLanguage = undefined;
let countryList = null;
function getCountryListAll(language) {
    if (countryList != null && countryListLanguage === language) {
        return countryList;
    }
    let tempMap = [];
    for (const superRegionCode in data) {
        const superRegion = data[superRegionCode];
        for (const countryCode in superRegion.parts) {
            const country = superRegion.parts[countryCode];
            tempMap.push(getSingleElement(countryCode, country, language));
        }
    }
    tempMap.sort((a, b) => {
        return a.label.localeCompare(b.label);
    });
    if (cacheEnabled) {
        countryListLanguage = language;
        countryList = tempMap;
    }
    return tempMap;
}
function getCountryListBySuperRegion(superRegionCode, language) {
    if (data[superRegionCode] == null) {
        return [];
    }
    let { parts } = data[superRegionCode];
    if (parts == null) {
        return [];
    }
    return getRegionFromParts(parts, language);
}
export function getLocaleNamesByCountryCode(countryCode) {
    for (const superRegionCode in data) {
        const superRegion = data[superRegionCode];
        let { parts } = superRegion;
        for (const dataCountryCode in parts) {
            if (countryCode === dataCountryCode) {
                let countryData = parts[countryCode];
                if (typeof countryData === 'string') {
                    return {
                        en: countryData,
                    };
                }
                if (countryData.localeName != null) {
                    return countryData.localeName;
                }
                let { name } = countryData;
                if (typeof name === 'string') {
                    return {
                        en: name,
                    };
                }
                return name;
            }
        }
    }
    return null;
}
export function getSupportedCountryToLanguageMap() {
    let map = {};
    for (const superRegionCode in data) {
        if (superRegionCode === 'OTHER') {
            continue;
        }
        const superRegion = data[superRegionCode];
        let { parts } = superRegion;
        for (const dataCountryCode in parts) {
            let countryData = parts[dataCountryCode];
            let supportedLanguages;
            if (typeof countryData === 'string' || countryData.langs == null) {
                supportedLanguages = ['en'];
            }
            else if (typeof countryData.langs === 'string') {
                supportedLanguages = [countryData.langs];
            }
            else {
                supportedLanguages = countryData.langs;
            }
            map[dataCountryCode] = supportedLanguages;
        }
    }
    return map;
}
export function isSupportedLocale(countryCode, lang) {
    for (const superRegionCode in data) {
        if (superRegionCode === 'OTHER') {
            continue;
        }
        const superRegion = data[superRegionCode];
        let { parts } = superRegion;
        for (const dataCountryCode in parts) {
            if (countryCode === dataCountryCode) {
                let countryData = parts[dataCountryCode];
                if (typeof countryData === 'string') {
                    return lang === 'en';
                }
                let { langs } = countryData;
                if (langs == null) {
                    return lang === 'en';
                }
                else if (typeof langs === 'string') {
                    return lang === langs;
                }
                else {
                    return langs.indexOf(lang) !== -1;
                }
            }
        }
    }
    return false;
}
export function getRegionByState(countryCode, state, language) {
    let country = countryRegions[countryCode];
    if (country == null) {
        return null;
    }
    for (let regionCode in country) {
        let region = country[regionCode];
        if (region.states.indexOf(state) !== -1) {
            let { name } = region;
            let localizedName = '';
            if (typeof name === 'string') {
                localizedName = name;
            }
            else if (language == null) {
                localizedName = name['en'];
            }
            else if (name[language] == null) {
                localizedName = name.en;
            }
            else {
                localizedName = name[language];
            }
            return {
                name: localizedName,
                region: regionCode,
                states: region.states,
            };
        }
    }
    return null;
}
export function getStates(countryCode, language) {
    const superRegion = getSuperRegion(countryCode);
    if (superRegion == null) {
        return null;
    }
    const superRegionData = data[superRegion.code];
    if (superRegionData.parts == null) {
        return null;
    }
    const countryData = superRegionData.parts[countryCode];
    if (typeof countryData === 'string' || countryData.parts == null) {
        return null;
    }
    const { parts } = countryData;
    return getRegionFromParts(parts, language);
}
