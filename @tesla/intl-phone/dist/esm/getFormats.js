import phoneFormats from '../data/formats.json.js';

// Importing from `.json.js` a workaround for a bug in web browsers' "native"
// import phoneFormats from '../data/formats.json';

/** ---------------------------------------------------------------------------------------
 * getFormats
 * 
 * @param {string} country - The two letter country string
 *
 * @return {Object} formats for that country
 */
const getFormats = (country) => {
  return phoneFormats[country];
};

export { getFormats };
