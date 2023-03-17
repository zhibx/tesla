const debug = false;

/**
 * Clears session storage.
 */
const clearLocalStorage = () => {
  localStorage.removeItem('guid');
  localStorage.removeItem('ak');
  localStorage.removeItem('lastChatRequestTimestamp');
  localStorage.removeItem('useLatestTDS');
  localStorage.removeItem('chatAttributes');
  localStorage.removeItem('avayaContextID');
  localStorage.removeItem('oceanaWebChatSocket');
  localStorage.removeItem('initializers');
  localStorage.removeItem('triageConfig');
  localStorage.removeItem('preEngagementConfig');
  localStorage.removeItem('submitLeadURL');
  localStorage.removeItem('callBackFormConfig');
};

/**
 * Get an object from local storage.
 * @param key
 * @returns the resulting pair
 */
const getLocalStorage = (key) => localStorage.getItem(key);

/**
 * Sets a specified key-value pair in local storage.
 * @param key
 * @param value
 */
const setLocalStorage = (key, value) => {
  localStorage.setItem(key, value);
};

/**
 * Output a debug message to the console.
 *
 * @param message
 */
const sendDebugMessage = (message) => {
  if (debug) {
    // eslint-disable-next-line no-console
    console.debug(message);
  }
};

function showElement(elementId, displayOption = 'block') {
  const elem = document.getElementById(elementId);
  if (elem) {
    elem.style.display = displayOption;
  }
}

function hideElement(elementId) {
  const elem = document.getElementById(elementId);
  if (elem) {
    elem.style.display = 'none';
  }
}

export {
  clearLocalStorage,
  getLocalStorage,
  setLocalStorage,
  sendDebugMessage,
  showElement,
  hideElement,
};
