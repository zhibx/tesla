import phoneFormats from '../data/formats.json.js';

// Importing from `.json.js` a workaround for a bug in web browsers' "native"
// import phoneFormats from '../data/formats.json';

/** ---------------------------------------------------------------------------------------
 * getCountryCode
 * 
 * @param {string} country - The two letter country string
 *
 * @return {string} The country code
 */
const getCountryCode = (country) => {
  const formats = phoneFormats[country];
  if( !formats ){
    console.warn(`intl-phone does not currently support country ${country}`);
    return;
  }
  return formats.countryCode;
};

export { getCountryCode };
