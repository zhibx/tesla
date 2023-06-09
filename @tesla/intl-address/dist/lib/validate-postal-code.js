import TESLA_POSTALCODE_REGEX_MAPPING from "../data/validate-postal-code.js";
/**
 * @param postalCode postal code string that needs to be validated
 * @param options countryCode as an optional property to validate against, default is used otherwise
 * @returns Returns whether a given postal code is valid or not
 */
export const validatePostalCode = (postalCode, options) => {
    const countryKey = (options && options.countryCode) || null;
    let regex = TESLA_POSTALCODE_REGEX_MAPPING.DEFAULT;
    if (countryKey != null && countryKey in TESLA_POSTALCODE_REGEX_MAPPING) {
        regex = TESLA_POSTALCODE_REGEX_MAPPING[countryKey];
    }
    return regex.test(postalCode);
};
