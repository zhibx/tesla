import patterns from '../data/patterns.json.js';

// Importing from `.json.js` a workaround for a bug in web browsers' "native"
// import patterns from '../data/patterns.json';

/** ---------------------------------------------------------------------------------------
 * getPatterns
 * 
 * @param {string} country - The two letter country string
 *
 * @return {Object} patterns for that country
 */
const getPatterns = (country) => {
  return patterns[country];
};

export { getPatterns };
