import axios from 'axios';
import { getSuperRegion } from '@tesla/region';
import qs from 'qs';
import { modal } from './tds/tds.js';
const { openModal } = modal;
import { getCountryCode } from '@tesla/intl-phone';
import LinkHelper from './helpers/LinkHelper.js';
import AvayaChatConfig from './config/AvayaChatConfig.js';
import AvayaChatStore from './store/AvayaChatStore.js';
import AvayaChatSocket from './component/AvayaChatSocket.js';
import AvayaChatUserInterface from './component/AvayaChatUserInterface.js';
import UserInterfaceEvents from './helpers/UserInterfaceEvents.js';
import DOMPurify from 'dompurify';
import {
  setLocalStorage,
  getLocalStorage,
  clearLocalStorage,
  sendDebugMessage,
  hideElement,
} from './utils/AvayaChatUtils.js';
import AnalyticsHelper from './helpers/AnalyticsHelper.js';
import './index.scss';

// noinspection JSCheckFunctionSignatures
class AvayaChat {
  constructor(config) {
    this.linkHelper = new LinkHelper(config);
    this.avayaChatConfig = {
      ...AvayaChatConfig,
      ...config,
    };

    // we need modifiedChatInit if chat was initiated on tcc pages
    if (config.bypassChatBubble || config.formDetails) {
      this.avayaChatConfig.modifiedChatInit = true;
    }

    this.setAnalyticsStatusAndCountryCode();
    this.avayaAnalyticsHelper = new AnalyticsHelper(
      this.avayaChatConfig.isTriagePreChat,
      this.avayaChatConfig.analyticsIsOn
    );

    this.customerDetails = {};
    this.avayaChatStore = new AvayaChatStore();

    this.userInterfaceEvents = new UserInterfaceEvents();

    this.avayaChatUserInterface = new AvayaChatUserInterface(
      this.avayaChatConfig,
      this.userInterfaceEvents,
      this.avayaAnalyticsHelper,
      () => {},
      () => {
        if (this.avayaChatStore.webSocket !== null && !this.avayaChatConfig.isWindowMinimized) {
          this.avayaChatSocket.clearRefresh();
          this.avayaChatStore.manualClose = true;

          if (this.avayaChatStore.closeTimer > 0) {
            clearTimeout(this.avayaChatStore.closeTimer);
          }

          if (this.avayaChatStore.webSocket.readyState !== WebSocket.CLOSING) {
            this.avayaChatStore.dontRetryConnection = true;
            this.quitChat();
          }
        }
      },
      async (data) => {
        // need these fields to present to avoid websocket errors
        data.phoneNumber = data.phoneNumber || '';
        data.phone = data.phone || { code: '', country: '', number: '' };
        data.zip = data.zip || '';
        data.postalCode = data.postalCode || '';
        data.firstName = data.firstName || '';
        data.lastName = data.lastName || '';
        data.province = data.province || '';
        data.city = data.city || '';

        const customerDetails = data;
        this.customerDetails = customerDetails;
        const { isChatLite } = config;

        this.avayaChatUserInterface.hideStatusPopUp();

        if (isChatLite) {
          await this.submitCallbackForm();

          const normalizedlocalStorageDetails = {};

          for (let i = 0; i < this.customerDetails.length; i++) {
            normalizedlocalStorageDetails[this.customerDetails[i].name] = this.customerDetails[
              i
            ].value;
          }

          normalizedlocalStorageDetails.postalCode = normalizedlocalStorageDetails.zip;
          setLocalStorage('customerDetails', JSON.stringify(normalizedlocalStorageDetails));

          const modalDialog = document.querySelector(`.tw-chat--avaya-chat__modal`);

          if (modalDialog) {
            modalDialog.scrollTo({
              top: modalDialog.scrollHeight,
            });
          }
        } else {
          this.customerDetails.phone = customerDetails.phoneNumber;
          this.customerDetails.zip = customerDetails.postalCode;
          setLocalStorage('customerDetails', JSON.stringify(this.customerDetails));
          // if we are not on tcc pages, set autoInitiate for next chat
          if (!this.avayaChatConfig.modifiedChatInit) {
            this.avayaChatConfig.autoInitiate = true;
          }
          this.initChat(true, customerDetails);
        }
      },
      (text) => {
        this.sendChatMessage(text);
      },
      () => {
        this.startTypingTimer();
      },
      () => {
        this.resetChat();
      }
    );

    this.avayaChatSocket = new AvayaChatSocket(
      this.avayaChatConfig,
      this.avayaChatUserInterface,
      this.avayaChatStore,
      (text, className, date, user) => {
        this.writeResponse(text, className, date, user);
      },
      (message) => {
        this.handleNotification(message);
      },
      (timeout) => {
        this.addToTimeouts(timeout);
      },
      () => {
        this.chatLogin();
      },
      () => {
        this.clearRefresh();
      },
      () => {
        this.writeChatEndedByAgent();
      },
      () => {
        this.writeChatSessionTransferred();
      }
    );
    this.lastIsTypingSent = 0;
    this.onHoldComfortInterval = null;
    this.onHoldUrlInterval = null;
    // by default, only use one service map.
    this.services = {
      1: {},
    };
    this.timeouts = [];
    this.webOnHoldComfortGroup = null;
    this.webOnHoldURLs = null;
    this.estimatedWaitTimeMapId = '1';
  }

  /**
   * Add to the timeouts.
   *
   * @param timeout
   */
  addToTimeouts(timeout) {
    sendDebugMessage('Running AvayaChat:addToTimeouts');
    this.timeouts.push(timeout);
  }

  /**
   * Sets analytics status depending on the country (analytics is off only in REEU countries)
   */
  setAnalyticsStatusAndCountryCode() {
    const countryCode = this.avayaChatConfig.locale.split('-')[1].toUpperCase();
    const superRegionCode = getSuperRegion(countryCode).code;

    let analyticsIsOn = true;
    if (
      superRegionCode === 'REEU' ||
      (this.avayaChatConfig.isChatLite && !this.avayaChatConfig.isTriagePreChat)
    ) {
      analyticsIsOn = false;
    }
    this.avayaChatConfig.analyticsIsOn = analyticsIsOn;
    this.avayaChatConfig.countryCode = countryCode;
  }

  /**
   * Log the user into the chat.
   */
  chatLogin() {
    sendDebugMessage('Running AvayaChat:chatLogin');
    const wantsEmail = false;
    const topic = this.avayaChatConfig.typeOfPage;
    const { leaseTime } = this.avayaChatConfig;
    // eslint-disable-next-line no-console
    console.debug(
      `WebChat: Chat attributes are ${JSON.stringify(this.avayaChatConfig.attributes)}`
    );

    const calledParty = window.location.href;
    let msg;

    // const isExistingContextID = getLocalStorage('avayaContextID');

    // if (!this.avayaChatStore.previouslyConnected && !isExistingContextID) {
    if (!this.avayaChatStore.previouslyConnected) {
      let customFields = [];
      if (typeof this.avayaChatStore.customerDetails.getUpdates !== 'undefined') {
        customFields = [
          {
            title: 'getUpdates',
            value: this.avayaChatStore.customerDetails.getUpdates,
          },
        ];
      }

      msg = {
        apiVersion: '1.0',
        type: 'request',
        body: {
          method: 'requestChat',
          deviceType: navigator.userAgent,
          routePointIdentifier: this.avayaChatConfig.routePointIdentifier,
          workFlowType: this.avayaChatConfig.workflowType,
          requestTranscript: wantsEmail,
          workRequestId: getLocalStorage('contextId'),
          calledParty,
          leaseTime,
          intrinsics: {
            channelAttribute: 'Chat',
            textDirection: document.dir.toUpperCase(),
            attributes: this.avayaChatConfig.attributes,
            email: this.avayaChatStore.customerDetails.email,
            name: this.avayaChatStore.customerDetails.firstName,
            lastName: this.avayaChatStore.customerDetails.lastName,
            phoneNumber: this.avayaChatStore.customerDetails.phoneNumber,
            teslaupdate: this.avayaChatStore.customerDetails.teslaupdate,
            topic,
            customFields,
          },
          priority: this.avayaChatConfig.priority,
          customData: this.avayaChatConfig.customData,
        },
      };
      /* this.writeResponse(
        this.avayaChatConfig.openingChatText,
        this.avayaChatConfig.writeResponseClassSystem
      ); */
    } else {
      if (!this.avayaChatConfig.bypassChatBubble) {
        this.avayaChatUserInterface.showChatButton();
      }

      // check if this is continuing after a page refresh or just a network glitch
      // if this is a page refresh, then we will request the full transcript
      const isAfterRefresh = this.avayaChatStore.customerDetails.isContinuingAfterRefresh;
      // eslint-disable-next-line no-console

      msg = {
        apiVersion: '1.0',
        type: 'request',
        body: {
          method: 'renewChat',
          guid: this.avayaChatStore.globallyUniqueIdentifier,
          authenticationKey: this.avayaChatStore.authenticationKey,
          requestFullTranscript: isAfterRefresh,
        },
      };
    }

    this.avayaChatSocket.sendMessage(msg);
  }

  /**
   * Change agent visibility
   *
   * @param id
   * @param role
   * @returns {boolean}
   */
  checkAgentVisibility(id, role) {
    sendDebugMessage('Running AvayaChat:checkAgentVisibility');
    // check if notifications are allowed/required
    const announceBot =
      id === 'AvayaAutomatedResource' && !this.avayaChatConfig.suppressChatbotPresence;
    const announceObserve = role === 'supervisor_observe' && this.avayaChatConfig.notifyOfObserve;
    const announceBarge =
      role === 'supervisor_barge' &&
      this.avayaChatConfig.notifyOfBarge &&
      !this.avayaChatConfig.notifyOfObserve;

    // if notifications are allowed/required, display them
    return announceBot || announceObserve || announceBarge || role === 'active_participant';
  }

  /**
   * Clear all timeouts
   */
  clearAllTimeouts() {
    sendDebugMessage('Running AvayaChat:clearAllTimeouts');
    for (let timeoutIndex = 0; timeoutIndex < this.timeouts.length; timeoutIndex++) {
      clearTimeout(this.timeouts[timeoutIndex]);
    }
  }

  /**
   * Clear session storage.
   */
  clearRefresh() {
    sendDebugMessage('Running AvayaChat:clearRefresh');
    // eslint-disable-next-line no-console
    console.debug('WebChat: clearing refresh');
    if (!this.avayaChatConfig.sessionWasTransferred) {
      clearLocalStorage();
    }
    this.avayaChatStore.initCalled = false;
  }

  /**
   * Clears the customer's typing timeout.
   *
   * @param agentTypeOut
   */
  // eslint-disable-next-line class-methods-use-this
  clearTypingTimeout(agentTypeOut) {
    sendDebugMessage('Running AvayaChat:clearTypingTimeout');
    if (agentTypeOut) {
      clearTimeout(agentTypeOut);
    }
  }

  /**
   * Converts the chatLogon attributes array into a service map
   * @returns {{Channel: [string]}}
   */
  createAttributeMap() {
    sendDebugMessage('Running AvayaChat:createAttributeMap');
    // eslint-disable-next-line no-console
    console.debug('Estimated Wait Time: Creating attribute map');

    // Channel.Chat is required for Web Chat, so hard-code this in here
    const attributes = {
      Channel: ['Chat'],
    };

    const attributesArray = this.avayaChatConfig.attributes;
    for (let i = 0; i < attributesArray.length; i++) {
      const attr = attributesArray[i];
      const array = attr.split('.');
      const key = array[0];
      const value = array[1];
      let attrArray;

      // Check if the attribute key (e.g. Location) already exists. If not, add it.
      // Otherwise, update the attributes.
      if (Object.keys(attributes).indexOf(key) < 0) {
        attrArray = [value];
        attributes[key] = attrArray;
      } else {
        attrArray = attributes[key];
        if (attrArray.indexOf(value) < 0) {
          attrArray.push(value);
        }
      }
    }

    return attributes;
  }

  /**
   * Handle WebSocket notification
   *
   * @param message
   */
  handleNotification(message) {
    sendDebugMessage('Running AvayaChat:handleNotification');
    const messageObject = JSON.parse(JSON.stringify(message));
    const { body } = messageObject;
    const { method } = body;
    if (method === this.avayaChatConfig.jsonMethodRequestChat) {
      this.notifyRequestChat(body);
    } else if (method === this.avayaChatConfig.jsonMethodRouteCancel) {
      this.notifyRouteCancel();
    } else if (method === this.avayaChatConfig.jsonMethodRequestNewParticipant) {
      this.notifyNewParticipant(body);
    } else if (method === this.avayaChatConfig.jsonMethodRequestIsTyping) {
      this.notifyIsTyping(body);
    } else if (method === this.avayaChatConfig.jsonMethodRequestNewMessage) {
      this.notifyNewMessage(body);
    } else if (method === this.avayaChatConfig.jsonMethodRequestCloseConversation) {
      this.notifyCloseConversation();
    } else if (method === this.avayaChatConfig.jsonMethodRequestParticipantLeave) {
      this.notifyParticipantLeave(body);
    } else if (method === this.avayaChatConfig.jsonMethodPing) {
      // do nothing with pings. They just confirm that the
      // WebSocket is open.
      // } else if (method === this.avayaChatConfig.jsonMethodFileTransfer) {
      //   this.notifyFileTransfer(body);
    } else {
      throw new TypeError('Received notification with unknown method: '.concat(method));
    }
  }

  /**
   * Initialize the AvayaChat
   *
   * @returns {Promise<void>}
   */
  async init(useLocalSession = false) {
    if (useLocalSession) {
      this.getChatSessionFromLocalStorage();
    }

    sendDebugMessage('Running AvayaChat:init');
    this.linkHelper.setupSecurity();

    const customerDetails = JSON.parse(getLocalStorage('customerDetails'));

    // if chat wasn't called from tcc page with additional parameter, and we have costumer details in local storage then
    // we updating avayaChatConfig with data from local storage to pre-populate chat lite and auto-initiate chat
    if (
      (customerDetails || this.avayaChatConfig.useEngagementPlaceholderData) &&
      !this.avayaChatConfig.modifiedChatInit
    ) {
      if (Object.keys(this.avayaChatConfig.formDetails.preEngagementForm).length === 0) {
        this.avayaChatConfig.formDetails.preEngagementForm = customerDetails;
        this.avayaChatConfig.autoInitiate = true;
      }

      if (Object.keys(this.avayaChatConfig.formDetails.chatLiteForm).length === 0) {
        this.avayaChatConfig.formDetails.chatLiteForm = customerDetails;
      }
    }

    this.avayaChatUserInterface.init();

    this.userInterfaceEvents.handleUIEvents(
      this.avayaChatConfig.analyticsIsOn,
      this.avayaChatConfig
    );

    if (this.avayaChatConfig.isChatLite) {
      return;
    }

    console.log('useLocalSession: ', useLocalSession);

    if (useLocalSession) {
      hideElement('main-topics');
      this.userInterfaceEvents.showChatEngagementForm();
      this.avayaChatUserInterface.reloadChatPanel();

      customerDetails.isContinuingAfterRefresh = true;
      this.writeResponse(
        this.avayaChatConfig.initializers.reloadingPageText,
        this.avayaChatConfig.writeResponseClassSystem
      );
      this.initChat(false, customerDetails);
    }

    // If chat is in progress, prevent user from accidentally closing the page.
    // Can't override default message due to security restrictions
    // so the value returned here doesn't really matter.
    window.addEventListener('beforeunload', () => {
      this.avayaAnalyticsHelper.fireEvent(
        this.avayaAnalyticsHelper.navigateInteraction,
        document.activeElement.href
      );

      if (this.avayaChatStore.initCalled) {
        return "You're about to end your session, are you sure?";
      }
      return false;
    });
  }

  /**
   * Initialize the chat.
   * @param {Boolean} disableControls - defines whether or not to disable the controls. If true, the user will not be able to type a message
   * @param customerDetails
   */
  initChat(disableControls = true, customerDetails) {
    sendDebugMessage('Running AvayaChat:initChat');
    // if the chat has already opened, don't bother opening it
    if (this.avayaChatStore.initCalled) {
      return;
    }
    hideElement('main-topics');
    this.avayaChatUserInterface.showLoader();
    this.avayaChatStore.customerDetails = customerDetails;
    this.avayaChatUserInterface.disableControls(disableControls);
    this.avayaChatStore.webChatUrl = this.linkHelper.getWebChatUrl();
    this.avayaChatSocket.openSocket(this.linkHelper.getWebChatUrl());
    this.avayaChatStore.initCalled = true;
  }

  /**
   * Notification of the close of the conversation.
   */
  notifyCloseConversation() {
    sendDebugMessage('Running AvayaChat:notifyCloseConversation');
    // Server will close the websocket
    this.avayaChatStore.manualClose = false;
    this.avayaChatStore.dontRetryConnection = true;
    clearLocalStorage();
  }

  /**
   * Notification of a file transfer.
   *
   * @param body
   */
  notifyFileTransfer(body) {
    sendDebugMessage('Running AvayaChat:notifyFileTransfer');
    // eslint-disable-next-line no-console
    console.info('WebChat: Notifying of file transfer');
    const agentname = body.agentName;
    const { uuid } = body;
    const wrid = body.workRequestId;
    const url = this.linkHelper.getFileDownloadUrl(uuid, wrid);
    const filename = body.name;
    const timestamp = new Date().toLocaleString();
    let message = this.avayaChatConfig.initializers.fileTransferMessageText;
    message = message.replace('{0}', agentname);
    message = message.replace('{1}', filename);
    message = message.replace('{2}', timestamp);
    message = message.replace('{3}', url);
    this.writeResponse(message, this.avayaChatConfig.writeResponseClassResponse, null, agentname);
  }

  /**
   * Notification of typing.
   *
   * @param body
   */
  notifyIsTyping(body) {
    sendDebugMessage('Running AvayaChat:notifyIsTyping');
    const isAgentTyping = body.isTyping;
    this.setLastChatRequestTimestamp();

    if (isAgentTyping === true) {
      const agent = this.avayaChatStore.users[body.agentId];
      agent.isTyping = isAgentTyping;
      this.updateTypingCell(agent, true);

      let agentTypeOut;
      if (agent.type === 'active_participant') {
        agentTypeOut = this.avayaChatConfig.activeAgentTypeOut;
      } else if (agent.type === 'passive_participant') {
        agentTypeOut = this.avayaChatConfig.passiveAgentTypeOut;
      } else {
        agentTypeOut = this.avayaChatConfig.supervisorTypeOut;
      }

      if (agentTypeOut !== undefined) {
        this.clearTypingTimeout(agentTypeOut);
      }

      agentTypeOut = setTimeout(() => {
        if (Object.keys(this.avayaChatStore.users).length !== 0) {
          agent.isTyping = false;
          this.updateTypingCell(agent, false);
        }
      }, this.avayaChatConfig.agentTypingTimeout);
      this.timeouts.push(agentTypeOut);
    }
  }

  /**
   * Notification of a new message.
   *
   * @param body
   */
  notifyNewMessage(body) {
    sendDebugMessage('Running AvayaChat:notifyNewMessage');
    const date = new Date(body.timestamp);
    const senderType = body.senderType.toLowerCase();
    this.setLastChatRequestTimestamp();

    if (senderType === 'customer') {
      // this is likely to be caused by customer refreshing page
      this.writeResponse(
        body.message,
        this.avayaChatConfig.writeResponseClassSent,
        date,
        body.displayName
      );
    } else if (senderType === 'live_agent') {
      this.avayaChatUserInterface.removeIsTypingIndicator(false, body.displayName);
      this.writeResponse(
        body.message,
        this.avayaChatConfig.writeResponseClassResponse,
        date,
        body.displayName
      );

      // send subject value from the form if it's was filled/present after first agent message
      // and only in case we didn't sent that message before
      const { subject } = this.avayaChatStore.customerDetails;

      if (this.avayaChatConfig.sendSubjectMessage && subject && subject.length > 0) {
        this.sendChatMessage(subject);
        this.avayaChatConfig.sendSubjectMessage = false;
      }
    } else {
      const chatMessageClass =
        senderType === 'bot'
          ? this.avayaChatConfig.writeResponseClassChatbot
          : this.avayaChatConfig.writeResponseClassResponse;
      if (body.type === 'widget') {
        this.writeResponse(body.data.text, chatMessageClass);
      } else {
        this.writeResponse(body.message, chatMessageClass);
      }
    }
  }

  /**
   * Notification of a new participant.
   *
   * @param body
   */
  notifyNewParticipant(body) {
    sendDebugMessage('Running AvayaChat:notifyNewParticipant');
    this.setLastChatRequestTimestamp();

    if (!this.avayaChatStore.chatWasInitiated) {
      this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.startedInteraction);
    }

    // enable the controls now in case there are any missing fields in the request
    this.avayaChatUserInterface.disableControls(false);
    this.stopOnHoldMessages();
    this.avayaChatStore.chatWasInitiated = true;

    const id = body.agentId;
    const { role, displayName } = body;

    if (this.checkAgentVisibility(id, role)) {
      this.avayaChatUserInterface.switchHeaderToChatMode(displayName);

      this.writeResponse(
        this.avayaChatConfig.initializers.agentJoinedMessage,
        this.avayaChatConfig.writeResponseClassSystem
      );
    }

    const agents = body.participants;
    this.updateUsers(agents);
    if (
      typeof body.webOnHoldComfortGroup !== 'undefined' &&
      body.webOnHoldComfortGroup.length > 0
    ) {
      const [webOnHoldComfortGroup] = body.webOnHoldComfortGroup;
      this.webOnHoldComfortGroup = webOnHoldComfortGroup;
    }
  }

  /**
   * Notification that a participant has left the chat.
   *
   * @param body
   */
  notifyParticipantLeave(body) {
    sendDebugMessage('Running AvayaChat:notifyParticipantLeave');
    const id = body.agentId;
    const agents = body.participants;

    // workaround to make sure Chrome closes on a two-node cluster
    if (body.endChatFlag) {
      this.avayaChatStore.dontRetryConnection = true;
    }

    // check if this user is actually present in the users to avoid multiple displays of "An agent has left".
    // This does not affect the chatbot.
    let isAgentContained = false;
    for (let i = 0; i < agents.length; i++) {
      if (agents[i].id === id) {
        isAgentContained = true;
        break;
      }
    }

    const leaveReason = body.leaveReason.toLowerCase();
    // check if this is the chatbot, barge and observer, and if they are to be suppressed.
    const suppressBot = leaveReason === 'escalate' && this.avayaChatConfig.suppressChatbotPresence;
    const suppressBarge =
      this.avayaChatStore.users[id].type === 'supervisor_barge' &&
      !this.avayaChatConfig.notifyOfBarge;
    const suppressObserver =
      this.avayaChatStore.users[id].type === 'supervisor_observe' &&
      !this.avayaChatConfig.notifyOfObserve;

    // if there are no users, check if this is a transfer.
    if (Object.keys(body.participants).length === 0) {
      // eslint-disable-next-line no-console
      console.info('WebChat: Only the customer remains in the room.');
      this.avayaChatUserInterface.disableControls(true);
      this.startOnHoldMessages();

      if (leaveReason === 'transfer') {
        this.writeResponse(
          this.avayaChatConfig.initializers.transferNotificationText,
          this.avayaChatConfig.writeResponseClassSystem
        );
      } else if (leaveReason === 'requeue') {
        this.writeResponse(
          this.avayaChatConfig.initializers.requeueNotificationText,
          this.avayaChatConfig.writeResponseClassSystem
        );
      } else if (leaveReason === 'escalate' && !this.avayaChatConfig.suppressChatbotPresence) {
        this.writeResponse(
          this.avayaChatConfig.initializers.chatbotTransferNotification,
          this.avayaChatConfig.writeResponseClassSystem
        );
      } else if (leaveReason === 'transfer_to_user') {
        this.writeResponse(
          this.avayaChatConfig.initializers.transferToUserText,
          this.avayaChatConfig.writeResponseClassSystem
        );
      } else {
        this.writeResponse(
          this.avayaChatConfig.initializers.agentLeftMessage,
          this.avayaChatConfig.writeResponseClassSystem
        );
      }
    } else if (!suppressBot && !isAgentContained && !suppressBarge && !suppressObserver) {
      this.writeResponse(
        this.avayaChatConfig.initializers.agentLeftMessage,
        this.avayaChatConfig.writeResponseClassSystem
      );
    }

    this.updateUsers(agents);
  }

  async submitLead() {
    // After openSocket.
    const { locale, submitLeadURL, typeOfPage, apiEndpointsDomain } = this.avayaChatConfig;
    const contextID = getLocalStorage('avayaContextID');

    const localeArr = locale.split('-');
    const countryCode = localeArr[1].toUpperCase();
    let updatedCustomerDetails = {};

    if (this.customerDetails && this.customerDetails['phone']) {
      updatedCustomerDetails['phone'] = {
        country: countryCode,
        code: getCountryCode(countryCode),
        number: this.customerDetails['phone'],
      };
    }

    const formattedCustomerDetails = {
      ...this.customerDetails,
      ...updatedCustomerDetails,
    };

    const submitLeadData = {
      useEngagementPlaceholderData: this.avayaChatConfig.useEngagementPlaceholderData,
      formId: typeOfPage,
      formData: { ...formattedCustomerDetails, attributes: this.avayaChatConfig.attributes.join() },
      locale,
      contextID,
    };

    const submitLeadPayload = qs.stringify(submitLeadData);
    const submitLeadUrl = apiEndpointsDomain + submitLeadURL;

    // TODO: back-end form validation.
    try {
      await axios.post(submitLeadUrl, submitLeadPayload);
    } catch (err) {
      console.error(err.response);
    }
  }

  async submitCallbackForm() {
    const { locale, callBackURL, apiEndpointsDomain } = this.avayaChatConfig;

    const submitLeadData = {
      formId: '179',
      formType: 'legacy',
      formLocale: locale,
      formData: { fields: this.customerDetails },
    };

    const submitLeadPayload = JSON.stringify(submitLeadData);
    const domainSpecificCallbackURL = apiEndpointsDomain + callBackURL;

    const options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: submitLeadPayload,
      url: domainSpecificCallbackURL,
    };

    // TODO: back-end form validation.
    this.avayaChatUserInterface.disableFormButtonAndInputs();

    try {
      await axios(options);
      this.avayaChatUserInterface.showStatusPopUp(true);
    } catch (err) {
      this.avayaChatUserInterface.showStatusPopUp(false);
      console.error(err.response);
    } finally {
      this.avayaChatUserInterface.hideChatButton();
    }
  }

  /**
   * Notification of a chat request.
   *
   * @param body
   */
  notifyRequestChat(body) {
    sendDebugMessage('Running AvayaChat:notifyRequestChat');
    this.avayaChatStore.globallyUniqueIdentifier = body.guid;
    this.avayaChatStore.customerDetails.displayName = body.intrinsics.name;
    this.avayaChatStore.authenticationKey = body.authenticationKey;

    const { workRequestId } = body;

    setLocalStorage('avayaContextID', workRequestId);
    setLocalStorage('guid', this.avayaChatStore.globallyUniqueIdentifier);
    setLocalStorage('ak', this.avayaChatStore.authenticationKey);
    setLocalStorage('oceanaWebChatSocket', this.linkHelper.secureSocket);
    setLocalStorage('customerDetails', JSON.stringify(this.avayaChatStore.customerDetails));
    setLocalStorage('initializers', JSON.stringify(this.avayaChatConfig.initializers));
    setLocalStorage(
      'preEngagementConfig',
      JSON.stringify(this.avayaChatConfig.preEngagementConfig)
    );
    setLocalStorage('triageConfig', JSON.stringify(this.avayaChatConfig.triageConfig));
    setLocalStorage('callBackFormConfig', JSON.stringify(this.avayaChatConfig.callBackFormConfig));
    setLocalStorage('chatAttributes', JSON.stringify(this.avayaChatConfig.attributes));

    // we don't want to submit each time we open new tab or moving to another page
    if (workRequestId && getLocalStorage('lastChatRequestTimestamp') == null) {
      this.submitLead();
      this.setUseLatestTDS();
    }

    this.setLastChatRequestTimestamp();

    // eslint-disable-next-line no-console
    console.info(
      `WebChat: workRequestId is ${workRequestId}, contactUUID/chatroom key is ${this.avayaChatStore.authenticationKey}. Valid email? ${body.isEmailValid}`
    );

    if (this.avayaChatStore.retries > 0) {
      this.avayaChatSocket.resetConnectionAttempts();
    }

    // if the customer has already been connected, don't play the on
    // hold messages
    if (!this.avayaChatStore.previouslyConnected) {
      const displayName = body.intrinsics.name;
      this.writeResponse(
        this.avayaChatConfig.initializers.AutomatedMessageBody,
        this.avayaChatConfig.writeResponseClassSent,
        null,
        displayName
      );

      this.avayaChatConfig.sendSubjectMessage = true;
      this.avayaChatStore.previouslyConnected = true;

      const [webOnHoldComfortGroups] = body.webOnHoldComfortGroups;
      this.webOnHoldComfortGroup = webOnHoldComfortGroups;
      const [webOnHoldURLs] = body.webOnHoldURLs;
      this.webOnHoldURLs = webOnHoldURLs;
      this.startOnHoldMessages();
      this.sendMessageWithEstimatedWaitTime();
    } else {
      this.writeResponse(
        this.avayaChatConfig.initializers.successfulReconnectionText,
        this.avayaChatConfig.writeResponseClassSystem
      );
    }

    this.avayaChatUserInterface.changeToChatMode();
    this.avayaChatUserInterface.hideLoader();
  }

  async sendMessageWithEstimatedWaitTime() {
    let minutesString = new Intl.RelativeTimeFormat(this.avayaChatConfig.locale).format(
      this.avayaChatConfig.estimatedWaitTime,
      'minutes'
    );

    // for zh-cn locale we need to add space between numbers and characters
    if (this.avayaChatConfig.locale === 'zh-cn') {
      // minutes label is 3 characters long for zh-cn locale, that's why we subtracting it
      const minutesStringLabelStart = minutesString.length - 3;
      const numberOfMinutes = minutesString.substring(0, minutesStringLabelStart);
      const minutesLabel = minutesString.substring(minutesStringLabelStart);

      minutesString = `${numberOfMinutes} ${minutesLabel}`;
    }

    const estimatedWaitTimeMsg = this.avayaChatConfig.initializers.chatEstimatedWaitTime.replace(
      '{0}',
      minutesString
    );
    this.writeResponse(estimatedWaitTimeMsg, this.avayaChatConfig.writeResponseClassSystem);
  }

  /**
   * Notification of a route cancellation.
   */
  notifyRouteCancel() {
    sendDebugMessage('Running AvayaChat:notifyRouteCancel');
    this.writeResponse(
      this.avayaChatConfig.initializers.routeCancelText,
      this.avayaChatConfig.writeResponseClassSystem
    );
    this.avayaChatStore.dontRetryConnection = true;
  }

  /**
   * Parses the service map.
   *
   * @param serviceMap
   */
  parseServiceMap(serviceMap) {
    sendDebugMessage('Running AvayaChat:parseServiceMap');
    // check if the Estimated Wait Time is defined here. We assume that chat is available,
    // unless specifically stated otherwise

    const {
      bypassChatBubble,
      maxWaitTime,
      minWaitTime,
      minAgentCount,
      chatAvailableMsg,
      chatNotAvailableMsg,
      noAgentsAvailableMsg,
      chatPossibleMsg,
    } = this.avayaChatConfig;

    let alertMsg = chatPossibleMsg;
    let chatAvailable = true;
    const { metrics } = serviceMap;
    if (metrics !== undefined) {
      const waitTime = parseInt(metrics.EWT, 10);
      const agentCount = parseInt(metrics.ResourceStaffedCount, 10);
      // eslint-disable-next-line no-console
      console.debug(
        `Estimated Wait Time: Wait time is ${waitTime}. Maximum wait time is ${maxWaitTime}`
      );
      // eslint-disable-next-line no-console
      console.debug(
        `Estimated Wait Time: ${agentCount} agents are logged in. Minimum allowed are ${minAgentCount}`
      );

      // if waitTime is less than the maximum and agents are logged in, chat is available. Otherwise, it isn't
      // FYI: if agents are logged in, that doesn't necessarily mean they *can* take a call. They may be busy, or on a break.
      if (waitTime < maxWaitTime && waitTime >= minWaitTime && agentCount >= minAgentCount) {
        const waitTimeInMins = Math.max(Math.floor(parseInt(waitTime, 10) / 60), 1);
        this.avayaChatConfig.estimatedWaitTime = waitTimeInMins;
        alertMsg = chatAvailableMsg.replace('{0}', waitTimeInMins);
        chatAvailable = true;
        // eslint-disable-next-line no-console
        console.debug(
          `Click to chat with an agent! Wait time is approximately ${waitTime} minutes`
        );
      } else {
        chatAvailable = false;
        if (waitTime > this.maxWaitTime) {
          // customise alert messages depending on the circumstances.
          alertMsg = chatNotAvailableMsg;
        } else {
          alertMsg = noAgentsAvailableMsg;
        }
      }
    }

    if (!chatAvailable) {
      this.avayaChatUserInterface.hideChatButton();
    } else {
      // if bypassChatBubble is true, then we want to open the chat as soon as it become
      // available and only in case it hasn't been opened before
      // eslint-disable-next-line no-lonely-if
      if (bypassChatBubble) {
        this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.impressionInteraction);
        openModal(this.avayaChatUserInterface.avayaChatDialog);
      } else {
        this.avayaChatUserInterface.showChatButton();
      }
    }

    // leave this in for ease of testing
    // eslint-disable-next-line no-console
    console.debug(alertMsg);
  }

  /**
   * Play on hold message.
   *
   * @param array
   */
  playOnHoldMessage(array) {
    sendDebugMessage('Running AvayaChat:playOnHoldMessage');
    let currentMsg;

    // if this has a urls array, it's a WebOnHold URL
    // otherwise, it's a comfort message
    if (array.urls !== undefined) {
      currentMsg = array.urls[array.currentSequence];
      const msgText = `${array.description}: ${currentMsg.url}`;
      this.writeResponse(msgText, this.avayaChatConfig.writeResponseClassSystem);
    } else {
      currentMsg = array.messages[array.currentSequence];
      this.writeResponse(currentMsg.message, this.avayaChatConfig.writeResponseClassSystem);
    }

    // eslint-disable-next-line no-param-reassign
    array.currentSequence += 1;
    if (
      (array.numberOfMessages !== undefined && array.currentSequence >= array.numberOfMessages) ||
      (array.urls !== undefined && array.currentSequence >= array.urls.length)
    ) {
      // eslint-disable-next-line no-param-reassign
      array.currentSequence = 0;
    }
  }

  /**
   * Return object for close connection request
   */
  // eslint-disable-next-line class-methods-use-this
  getCloseRequest() {
    return {
      apiVersion: '1.0',
      type: 'request',
      body: {
        method: 'closeConversation',
      },
    };
  }

  /**
   * Quit the chat.
   */
  quitChat() {
    sendDebugMessage('Running AvayaChat:quitChat');
    // Prevent reconnect attempts if customer clicks 'Close' while chat is
    // reconnecting
    this.avayaChatStore.dontRetryConnection = true;
    this.avayaChatStore.manualClose = true;
    this.clearAllTimeouts();
    if (
      this.avayaChatStore.webSocket !== null &&
      this.avayaChatStore.webSocket.readyState === this.avayaChatStore.webSocket.OPEN
    ) {
      const closeRequest = this.getCloseRequest();
      this.writeResponse(
        this.avayaChatConfig.initializers.closeRequestText,
        this.avayaChatConfig.writeResponseClassSent
      );
      this.avayaChatSocket.sendMessage(closeRequest, this.avayaChatStore.webSocket);
    }
  }

  /**
   * Check if have session stored in local store.
   *
   * @returns {boolean}
   */
  checkForValidSessionInLocalStorage() {
    sendDebugMessage('Running AvayaChat:checkForValidSessionInLocalStorage');

    const ak = getLocalStorage('ak');
    const guid = parseInt(getLocalStorage('guid'), 10);
    const lastChatRequestTimestamp = parseInt(getLocalStorage('lastChatRequestTimestamp'), 10);

    if (
      Number.isNaN(lastChatRequestTimestamp) ||
      ak === null ||
      guid === null ||
      Number.isNaN(guid)
    ) {
      // eslint-disable-next-line no-console
      console.warn('WebChat: Chat opened first time!');
      this.clearRefresh();
      return false;
    }

    const currentTimestamp = Date.now();
    const expired =
      currentTimestamp - lastChatRequestTimestamp >=
      this.avayaChatConfig.refreshTimeoutSeconds * 1000;

    // eslint-disable-next-line no-console
    console.debug('Current and closing timestamps are', currentTimestamp, lastChatRequestTimestamp);
    // eslint-disable-next-line no-console
    console.debug(ak, guid, expired);

    if (expired) {
      // eslint-disable-next-line no-console
      console.warn('WebChat: session has probably expired');
      this.clearRefresh();
      return false;
    }

    return true;
  }

  /**
   * Get session from local store.
   */
  getChatSessionFromLocalStorage() {
    console.debug('WebChat: get chat session from local store');

    const ak = getLocalStorage('ak');
    const guid = parseInt(getLocalStorage('guid'), 10);
    const oceanaWebChatSocket = getLocalStorage('oceanaWebChatSocket');
    const initializers = JSON.parse(getLocalStorage('initializers'));
    const triageConfig = JSON.parse(getLocalStorage('triageConfig'));
    const preEngagementConfig = JSON.parse(getLocalStorage('preEngagementConfig'));
    const callBackFormConfig = JSON.parse(getLocalStorage('callBackFormConfig'));
    const chatAttributes = JSON.parse(getLocalStorage('chatAttributes'));

    this.avayaChatStore.previouslyConnected = true;
    this.avayaChatStore.globallyUniqueIdentifier = guid;
    this.avayaChatStore.authenticationKey = ak;

    this.linkHelper.secureSocket = oceanaWebChatSocket;

    this.avayaChatConfig.initializers = initializers;
    this.avayaChatConfig.triageConfig = triageConfig;
    this.avayaChatConfig.preEngagementConfig = preEngagementConfig;
    this.avayaChatConfig.callBackFormConfig = callBackFormConfig;
    this.avayaChatConfig.attributes = chatAttributes;
  }

  /**
   * Reset the chat.
   */
  resetChat() {
    sendDebugMessage('Running AvayaChat:resetChat');
    // eslint-disable-next-line no-console
    console.info('WebChat: Resetting chat');
    const closeRequest = this.getCloseRequest();
    this.avayaChatSocket.sendMessage(closeRequest, this.avayaChatStore.webSocket);
    this.clearAllTimeouts();
    this.avayaChatStore.authenticationKey = null;
    this.avayaChatStore.globallyUniqueIdentifier = null;
    this.avayaChatStore.chatWasInitiated = false;
    this.lastIsTypingSent = 0;
    this.avayaChatSocket.resetWebSocket();
    this.avayaChatStore.dontRetryConnection = false;
    clearLocalStorage();
  }

  /**
   * Sends a chat message to the server. If the message box is empty, nothing
   * is sent.
   *
   * @param text
   */
  sendChatMessage(text) {
    sendDebugMessage('Running AvayaChat:sendChatMessage');
    const sanitizedInput = DOMPurify.sanitize(text);
    if (text.length !== 0) {
      // add the timestamp message, then the chat.
      this.writeResponse(
        sanitizedInput,
        this.avayaChatConfig.writeResponseClassSent,
        null,
        this.avayaChatStore.customerDetails.displayName
      );
      const message = {
        apiVersion: '1.0',
        type: 'request',
        body: {
          method: 'newMessage',
          message: sanitizedInput,
          type: 'text',
          data: {
            message: sanitizedInput,
          },
          customData: this.avayaChatConfig.customData,
        },
      };
      this.avayaChatSocket.sendMessage(message);
      // this.avayaChatUserInterface.clearMessageInput();
    }
  }

  /**
   * Lets the agents know that the customer is typing.
   *
   * @param isUserTyping
   */
  sendIsTyping(isUserTyping) {
    sendDebugMessage('Running AvayaChat:sendIsTyping');
    const isTypingMessage = {
      apiVersion: '1.0',
      type: 'request',
      body: {
        method: 'isTyping',
        isTyping: isUserTyping,
      },
    };

    // update lastisTypingSent timestamp
    this.lastIsTypingSent = Date.now();

    this.avayaChatSocket.sendMessage(isTypingMessage);
  }

  /**
   * Start the on hold messages.
   */
  startOnHoldMessages() {
    sendDebugMessage('Running AvayaChat:startOnHoldMessages');
    // eslint-disable-next-line no-console
    console.info('WebChat: Starting the On Hold messages');
    const onHoldUrlsDefined = this.webOnHoldURLs !== null && this.webOnHoldURLs.urls.length > 0;
    const onHoldMessagesDefined =
      this.webOnHoldComfortGroup !== null && this.webOnHoldComfortGroup.messages.length > 0;

    if (!onHoldUrlsDefined && !onHoldMessagesDefined) {
      // eslint-disable-next-line no-console
      console.warn('WebChat: On Hold messages are not defined!');
    }

    if (onHoldMessagesDefined) {
      // sort the webOnHoldComfortGroup according to sequence
      this.webOnHoldComfortGroup.messages = this.webOnHoldComfortGroup.messages.sort(
        (a, b) => a.sequence - b.sequence
      );
      this.webOnHoldComfortGroup.currentSequence = 0;

      this.onHoldComfortInterval = setInterval(() => {
        this.playOnHoldMessage(this.webOnHoldComfortGroup);
      }, this.webOnHoldComfortGroup.delay * 1000);
      this.timeouts.push(this.onHoldComfortInterval);
    }

    if (onHoldUrlsDefined) {
      this.webOnHoldURLs.currentSequence = 0;

      this.onHoldUrlInterval = setInterval(() => {
        this.playOnHoldMessage(this.webOnHoldURLs);
      }, this.webOnHoldURLs.holdTime * 1000);
      this.timeouts.push(this.onHoldUrlInterval);
    }
  }

  /**
   * Start the customer's typing timer.
   */
  startTypingTimer() {
    sendDebugMessage('Running AvayaChat:startTypingTimer');
    const isTypingTimer = Date.now();
    const timerExpiryTime = this.lastIsTypingSent + this.avayaChatConfig.timeBetweenMsgs;

    if (isTypingTimer >= timerExpiryTime) {
      this.sendIsTyping(true);
    }
  }

  /**
   * Stop the on hold messages.
   */
  stopOnHoldMessages() {
    sendDebugMessage('Running AvayaChat:stopOnHoldMessages');
    // eslint-disable-next-line no-console
    console.info('Web On Hold: Stopping messages');
    clearInterval(this.onHoldUrlInterval);
    clearInterval(this.onHoldComfortInterval);
  }

  /**
   * Adds the "Typing" message.
   * @param agent
   * @param isTyping
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  updateTypingCell(agent, isTyping) {
    sendDebugMessage('Running AvayaChat:updateTypingCell');
    if (typeof agent !== 'undefined' && typeof agent.displayName !== 'undefined') {
      if (isTyping) {
        this.avayaChatUserInterface.addIsTypingIndicator(agent.displayName);
      } else {
        this.avayaChatUserInterface.removeIsTypingIndicator(false, agent.displayName);
      }
    }
  }

  /**
   * Update the users.
   *
   * @param agents
   */
  updateUsers(agents) {
    sendDebugMessage('Running AvayaChat:updateUsers');
    this.avayaChatStore.users = {};

    if (agents !== undefined) {
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        if (
          this.checkAgentVisibility(agent.id, agent.type) ||
          agent.type === 'passive_participant'
        ) {
          // eslint-disable-next-line no-console
          console.debug(`WebChat: Adding agent with id ${agent.id} and name ${agent.name}`);

          this.avayaChatStore.users[agent.id] = {
            displayName: agent.name,
            isTyping: false,
            agentType: agent.type,
          };
        }
      }
    }
  }

  /**
   * Write the chat response.
   *
   * @param text
   * @param className
   * @param date
   * @param user
   */
  // eslint-disable-next-line no-unused-vars,class-methods-use-this
  writeResponse(text, className, date = null, user = null) {
    sendDebugMessage('Running AvayaChat:writeResponse');
    this.avayaChatUserInterface.appendMessage(text, className, date);
    this.setLastChatRequestTimestamp();
  }

  /**
   * Write the chat ended by agent response.
   */

  writeChatEndedByAgent() {
    sendDebugMessage('Running AvayaChat:writeChatEnded');
    this.avayaChatUserInterface.writeChatBoxMessage(
      this.avayaChatConfig.initializers.MessageCanvasTrayHeader,
      this.avayaChatConfig.initializers.MessageCanvasTrayParagraph,
      true
    );
  }

  /**
   * Write the chat transferred response.
   */

  writeChatSessionTransferred() {
    sendDebugMessage('Running AvayaChat:writeChatSessionTransferred');
    this.avayaChatUserInterface.writeChatBoxMessage(
      '',
      this.avayaChatConfig.initializers.chatSessionTransferred,
      false
    );
    this.avayaChatUserInterface.disableControls(true);
    this.avayaChatUserInterface.hideChatButton();
    this.avayaChatConfig.sessionWasTransferred = true;
  }

  setLastChatRequestTimestamp() {
    this.avayaChatStore.lastChatRequestTimestamp = Date.now();
    setLocalStorage('lastChatRequestTimestamp', this.avayaChatStore.lastChatRequestTimestamp);
  }

  setUseLatestTDS() {
    setLocalStorage('useLatestTDS', true);
  }
}

export default AvayaChat;
