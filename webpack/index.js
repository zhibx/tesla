import AvayaChatInit from './AvayaChatInit.js';

const startChat = () => {
  console.debug('version: 1.1.20-beta.0');

  // do not start chat more than once
  if (window.avaya && window.avaya.is_initialized === true) {
    return;
  }

  window.avaya.is_initialized = true;

  const locale = window.avaya_chat_locale ? window.avaya_chat_locale : 'en-us';
  const localeUpdated = window.avaya && window.avaya.locale ? window.avaya.locale : locale;

  // legacy flag: for backward compatibility (CUA-2364-enable-chat-lite)
  // defaulting chatlite to false as we have more locales without it than with it at the moment.
  const chatLiteFlag = window.show_avaya_chat_lite ? window.show_avaya_chat_lite : false;

  // new flag: should take priority over legacy flag (cua-2871-show-avaya-chat-consolidated)
  const chatLiteFlagUpdated =
    window.avaya && typeof window.avaya.chat_lite !== 'undefined'
      ? window.avaya.chat_lite
      : chatLiteFlag;

  const triagePreChat = window.show_avaya_triage ? window.show_avaya_triage : false;
  const triagePreChatUpdated =
    window.avaya && typeof window.avaya.triage !== 'undefined'
      ? window.avaya.triage
      : triagePreChat;

  const hideOnMobiles = window.hide_avaya_on_mobile ? !window.hide_avaya_on_mobile : false;
  const hideOnMobilesUpdated =
    window.avaya && typeof window.avaya.mobile !== 'undefined'
      ? !window.avaya.mobile
      : hideOnMobiles;

  const ifEnergyPage = window.if_avaya_energy_page ? !window.if_avaya_energy_page : false;
  const ifEnergyPageUpdated =
    window.avaya && typeof window.avaya.energy !== 'undefined'
      ? !window.avaya.energy
      : ifEnergyPage;

  // option to pass attributes for pages that use static assets integration
  const requestAttributes =
    window.avaya && typeof window.avaya.attributes !== 'undefined' ? window.avaya.attributes : {};

  AvayaChatInit({
    locale: localeUpdated,
    chatLiteFlag: chatLiteFlagUpdated,
    triagePreChat: triagePreChatUpdated,
    hideOnMobiles: hideOnMobilesUpdated,
    ifEnergyPage: ifEnergyPageUpdated,
    ...requestAttributes,
  });
};

// expose init_chat and is_initialized to init chat asynchronously
if (!window.avaya) {
  window.avaya = {};
}
window.avaya.init_chat = startChat;
window.avaya.is_initialized = false;

document.addEventListener('DOMContentLoaded', startChat);
