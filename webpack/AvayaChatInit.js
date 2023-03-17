import axios from 'axios';
import qs from 'qs';
import { getLocalStorage } from './utils/AvayaChatUtils.js';
import AvayaChatShared from './AvayaChat.js';

const AvayaChatInit = (requestData, optionalData = {}) => {
  requestData.locale = requestData.locale.replace(/[_-]/, '-').toLowerCase();

  // get chat optional params from window or chat initiation
  let optionalParams = {};
  if (window.avaya && window.avaya.options) {
    optionalParams = window.avaya.options;
  } else if (window.avaya_chat_options) {
    optionalParams = window.avaya_chat_options;
  } else {
    optionalParams = optionalData;
  }

  const url = `${
    optionalParams.apiEndpointsDomain ? optionalParams.apiEndpointsDomain : ''
  }/conversation/check-availability-v2`;

  let counter = 0;
  window.avaya.is_agent_available = false;

  const checkAvayaChatAvailability = () => {
    axios
      .post(url, qs.stringify(requestData))
      .then((response) => {
        const {
          error = false,
          success,
          avayaPrerequisite,
          maxAttempts = 1,
          useLatestTDS = false,
          useEngagementPlaceholderData = false,
        } = response.data;

        let { chatWidgetParams } = response.data;
        chatWidgetParams = { ...chatWidgetParams, ...optionalParams };

        // Only show chat if success === true
        // when chat lite is implemented we will show chat-lite if success === false.
        if (success === true) {
          window.avaya.is_agent_available = true;

          // eslint-disable-next-line no-use-before-define
          clearInterval(pingAvaya);

          // eslint-disable-next-line
          if (useLatestTDS) {
            (async () => {
              const { default: AvayaChat } = await import('./AvayaChat.js');

              const avayaChat = new AvayaChat({
                ...chatWidgetParams,
                isTriagePreChat: requestData.triagePreChat,
                useEngagementPlaceholderData: useEngagementPlaceholderData,
              });
              avayaChat.init();
              avayaChat.parseServiceMap(
                avayaPrerequisite.serviceMetricsResponseMap[avayaChat.estimatedWaitTimeMapId]
              );
            })();
          } else {
            (async () => {
              const { default: AvayaChatPrevious } = await import('./AvayaChatPrevious.js');
              const avayaChat = new AvayaChatPrevious({
                ...chatWidgetParams,
                isTriagePreChat: requestData.triagePreChat,
              });
              avayaChat.init();
              avayaChat.parseServiceMap(
                avayaPrerequisite.serviceMetricsResponseMap[avayaChat.estimatedWaitTimeMapId]
              );
            })();
          }
        } else if (requestData.chatLiteFlag === true) {
          window.avaya.is_agent_available = false;
          // eslint-disable-next-line no-use-before-define
          clearInterval(pingAvaya);

          if (useLatestTDS) {
            (async () => {
              const { default: AvayaChat } = await import('./AvayaChat.js');

              const avayaChat = new AvayaChat({
                ...chatWidgetParams,
                isTriagePreChat: requestData.triagePreChat,
                isChatLite: true,
              });

              avayaChat.init();
            })();
          } else {
            (async () => {
              const { default: AvayaChatPrevious } = await import('./AvayaChatPrevious.js');

              const avayaChat = new AvayaChatPrevious({
                ...chatWidgetParams,
                isTriagePreChat: requestData.triagePreChat,
                isChatLite: true,
              });

              avayaChat.init();
            })();
          }
        } else if (error === true || counter >= maxAttempts) {
          window.avaya.is_agent_available = false;
          // eslint-disable-next-line no-use-before-define
          clearInterval(pingAvaya);
        } else {
          window.avaya.is_agent_available = false;
        }

        // eslint-disable-next-line no-param-reassign
        counter += 1;
        console.debug('counter incremented: ', counter);
      })
      .catch(() => {
        // eslint-disable-next-line no-use-before-define
        clearInterval(pingAvaya);
      });
  };

  let pingAvaya;
  // don't show chat and call endpoints if hideOnMobiles is true and device width is smaller than 600px
  if (!(requestData.hideOnMobiles && window.screen.width <= 599)) {
    const avayaChatShared = new AvayaChatShared({
      isTriagePreChat: requestData.triagePreChat,
    });
    const sessionExist = avayaChatShared.checkForValidSessionInLocalStorage();

    // eslint-disable-next-line
    (async () => {
      // check if session exist, show chat without calling endpoint if it exist
      if (sessionExist) {
        const useLatestTDS = getLocalStorage('useLatestTDS');

        if (useLatestTDS !== 'false') {
          (async () => {
            const { default: AvayaChat } = await import('./AvayaChat.js');
            const avayaChat = new AvayaChat({
              isTriagePreChat: requestData.triagePreChat,
            });
            avayaChat.init(true);
          })();
        } else {
          (async () => {
            const { default: AvayaChat } = await import('./AvayaChatPrevious.js');
            const avayaChat = new AvayaChat({
              isTriagePreChat: requestData.triagePreChat,
            });
            avayaChat.init(true);
          })();
        }
      } else {
        pingAvaya = setInterval(checkAvayaChatAvailability, 15000);
        checkAvayaChatAvailability();
      }
    })();
  }
};

export default AvayaChatInit;
