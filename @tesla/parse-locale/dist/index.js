/**
 * Returns object with lang and country properties from locale string
 * @param {String} locale (langCode_CountryCode: [en-US, de-DE, it-IT, etc...])
 */
export function parseLocale(locale) {
    if (!locale) {
        locale = "en-US";
    }
    const parsed = locale.split(/[-_]/);
    let lang = parsed[0].toLowerCase();
    let country = undefined;
    // www.tesla.com uses country code for jp but full locale for
    // everything else. Not sure why but being safe here.
    if (lang === "jp") {
        lang = "ja";
    }
    if (parsed.length >= 2 && parsed[1].length !== 0) {
        country = parsed[parsed.length - 1].toUpperCase();
    }
    else {
        country = lang.toUpperCase();
        switch (country) {
            case "AR":
                country = "AE";
                break;
            case "CS":
                country = "CZ";
                break;
            case "DA":
                country = "DK";
                break;
            case "EL":
                country = "GR";
                break;
            case "EN":
                country = "US";
                break;
            case "HE":
                country = "IL";
                break;
            case "JA":
                country = "JP";
                break;
            case "KO":
                country = "KR";
                break;
            case "SL":
                country = "SI";
                break;
            case "SV":
                country = "SE";
                break;
            case "ZH":
                country = "CN";
                break;
        }
    }
    return {
        country,
        lang,
        locale: `${lang}-${country}`,
    };
}
/**
 * Function to localize URL
 */
export function localizeUrl(
/**
 * Path of the url. Example:
 * https://www.tesla.com/where/do/i/go
 * The path is `where/do/i/go`
 */
url, opts) {
    var _a, _b;
    if (!opts) {
        opts = {};
    }
    let path = url;
    const inputLocale = opts.locale || "";
    let baseUrl = opts.baseUrl || "";
    const query = opts.query;
    const lowercaseLocale = opts.lowercaseLocale || false;
    let qstring = "";
    // ignore base url if protocol is already present in url
    const baseUrlPresent = url.match(/^(http(s)?:)?\/\//);
    const parsed = parseLocale(inputLocale);
    const { country } = parsed;
    let { locale } = parsed;
    baseUrl = country === "CN" ? baseUrl.replace(".com", ".cn") : baseUrl.replace(".cn", ".com");
    if (baseUrlPresent) {
        baseUrl = "";
    }
    // Make sure we keep _ in locale if this was in the input
    if (inputLocale.indexOf("_") === 2) {
        locale = locale.replace("-", "_");
    }
    // don't add locale to URL if it is en_US or if it is undefined/null
    if (!locale || ["US", "CN"].indexOf(country) >= 0) {
        locale = "";
    }
    else if ((_a = opts === null || opts === void 0 ? void 0 : opts.customLocaleMap) === null || _a === void 0 ? void 0 : _a[locale]) {
        locale = (_b = opts === null || opts === void 0 ? void 0 : opts.customLocaleMap) === null || _b === void 0 ? void 0 : _b[locale];
    }
    // strip existing locale from path
    path = path.replace(/^\/?([a-z]{2}[-_][a-z]{2}|jp)/i, "");
    let localePart = locale && locale.replace("-", (opts && opts.delimiter) || "-");
    if (localePart && lowercaseLocale) {
        localePart = localePart === null || localePart === void 0 ? void 0 : localePart.toLowerCase();
    }
    // strip protocol out of path if it exists
    const parts = [baseUrl, localePart, path].filter((part) => part);
    let result = "";
    for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part) {
            // clean extra slashes from URL parts
            if (baseUrlPresent || (baseUrl && i === 0)) {
                // For baseUrl we support leading //
                part = part.replace(/\/$/g, "");
            }
            else {
                part = part.replace(/^\/|\/$/g, "");
            }
            result += part;
            if (i < parts.length - 1) {
                result += "/";
            }
        }
    }
    // Prepend leading slash if no base url passed.
    // Also, when a base url is present in the url passed, we should not prepend a slash.
    if (!baseUrlPresent && (!baseUrl || (baseUrl.length === 0 && result.substring(0, 1) !== "/"))) {
        result = "/" + result;
    }
    if (query) {
        for (const p in query) {
            qstring += p + "=" + query[p] + "&";
        }
        if (qstring.length) {
            result += "?" + qstring.substring(0, qstring.length - 1);
        }
    }
    // clean url if extra slashes were added
    return result;
}
