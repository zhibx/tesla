import _get from 'lodash/get';

export const getLocale = () => _get(window, 'tesla.App.locale', 'en_US');

export const getCountry = () => _get(window, 'tesla.App.country', 'US');

export const getUICountry = () => _get(window, 'tesla.App.uiCountry', 'US');

export const getCountry2 = () => {
  return _get(window, 'i18n.region', 'US').toUpperCase();
};
