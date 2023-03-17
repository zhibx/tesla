import anchorify from 'anchorify';
import { localizeUrl } from '@tesla/parse-locale';
import { modal } from '../tds/tds.js';
const { closeModal, initModals, openModal } = modal;
import { sendDebugMessage, showElement, hideElement } from '../utils/AvayaChatUtils.js';
import FormHelper from '../helpers/FormHelper.js';
import DOMPurify from 'dompurify';
import { addGIOEvent, GIO_EVENTS, GIO_EVENT_TYPES } from '../utils/gio';
import { getCountryData, isCN } from '../utils/LocationUtils';
import { flag } from '../Data/flags';

class AvayaChatUserInterface {
  constructor(
    avayaChatConfig,
    userInterfaceEvents,
    avayaAnalyticsHelper,
    onModalOpen = () => {},
    onModalClose = () => {},
    onChatFormSubmit = () => {},
    onChatFooterSubmit = () => {},
    onTyping = () => {},
    resetChat = () => {}
  ) {
    this.avayaChatConfig = avayaChatConfig;
    this.userInterfaceEvents = userInterfaceEvents;
    this.avayaAnalyticsHelper = avayaAnalyticsHelper;
    this.avayaChatDialog = null;
    this.chatPrefix = 'avaya-chat';
    this.modalId = 'avaya-chat-modal';
    this.onModalOpen = onModalOpen;
    this.onModalClose = onModalClose;
    this.onChatFormSubmit = onChatFormSubmit;
    this.onChatFooterSubmit = onChatFooterSubmit;
    this.onTyping = onTyping;
    this.resetChat = resetChat;
    this.loaderTimeout = null;
    this.statusMessageTimeout = null;
    window.appendMessage = this.appendMessage;
    this.isInChatMode = false;
    this.endChatMessageVisible = false;
    this.chatWasClosedByAgent = false;
    this.cityList = null;
    this.provinceList = null;
    this.selectedCity = null;
    this.selectedProvince = null;
    this.currentPage = window.document.location.pathname.split('/')[1];
    this.pagesUpdatePosition = ['trips'];
  }

  /**
   * Set the attributes of a dom element.
   *
   * @param element
   * @param attributes
   */
  static setAttributes(element, attributes) {
    sendDebugMessage('Running AvayaChatUserInterface:setAttributes');
    Object.entries(attributes).forEach((args) => element.setAttribute(...args));
  }

  addIsTypingIndicator(userName) {
    sendDebugMessage('Running AvayaChatUserInterface:addIsTypingIndicator');

    const avayaChatFrame = document.querySelector(`.tw-chat--${this.chatPrefix}__frame`);
    if (userName && avayaChatFrame) {
      const chatMessage = document.createElement('div');
      chatMessage.classList.add(
        `tw-chat--${this.chatPrefix}__chat-message`,
        'tw-chat--chat-message',
        'tw-chat--chat-message--typing'
      );
      chatMessage.dataset.userTyping = userName;

      const chatMessageUser = document.createElement('div');
      chatMessageUser.classList.add('tw-chat--chat-message__response');

      const typingIndicator = document.createElement('div');
      typingIndicator.classList.add('tw-chat--chat-message__typing-indicator');

      const typingBullet = document.createElement('span');
      typingBullet.classList.add('tw-chat--chat-message__typing-bullet');

      for (let index = 0; index < 3; index++) {
        typingIndicator.append(typingBullet.cloneNode(true));
      }

      chatMessageUser.append(typingIndicator);
      chatMessage.append(chatMessageUser);

      avayaChatFrame.append(chatMessage);
      avayaChatFrame.scrollTo({
        top: avayaChatFrame.scrollHeight,
      });
    }
  }

  /**
   * Append a paragraph or other element to the chat transcript.
   * Includes an autoscroll mechanism
   *
   * @param text
   * @param className
   * @param date
   * @param user
   */
  appendMessage(text, className, date) {
    sendDebugMessage('Running AvayaChatUserInterface:appendMessage');

    if (date === null) {
      // eslint-disable-next-line no-param-reassign
      date = new Date();
    }

    const time = new Intl.DateTimeFormat(this.avayaChatConfig.locale, {
      timeStyle: 'short',
    }).format(date);

    const avayaChatFrame = document.querySelector(`.tw-chat--${this.chatPrefix}__frame`);

    if (avayaChatFrame) {
      const chatMessage = document.createElement('div');

      chatMessage.classList.add(
        `tw-chat--${this.chatPrefix}__chat-message`,
        'tw-chat--chat-message'
      );

      const chatMessageUser = document.createElement('div');
      chatMessageUser.classList.add(`tw-chat--chat-message__${className}`);

      const chatMessageMeta = document.createElement('div');
      chatMessageMeta.classList.add(
        'tw-chat--chat-message__meta',
        `tw-chat--chat-message__meta__${className}`,
        'tds-text--caption'
      );

      const chatMessageTime = document.createElement('span');
      chatMessageTime.classList.add('tw-chat--chat-message__time');

      chatMessageTime.innerText = time;

      const chatMessageParagraph = document.createElement('p');

      chatMessageParagraph.innerHTML = DOMPurify.sanitize(anchorify(text, { target: '_blank' }));

      const linksInParagraph = chatMessageParagraph.querySelectorAll('a');
      linksInParagraph.forEach((link) => {
        link.classList.add('tw-chat--tds-link');
      });

      chatMessageMeta.append(chatMessageTime);

      chatMessageUser.append(chatMessageParagraph);

      chatMessage.append(chatMessageUser);
      chatMessage.append(chatMessageMeta);

      avayaChatFrame.append(chatMessage);
      avayaChatFrame.scrollTo({
        top: avayaChatFrame.scrollHeight,
      });
    }

    if (this.avayaChatConfig.isWindowMinimized) {
      showElement('avaya-chat__button-badge');
    }
  }

  /**
   * Chat the dialog to Chat mode.
   */
  changeToChatMode() {
    sendDebugMessage('Running AvayaChatUserInterface:changeToChatMode');
    document
      .querySelector(`.tw-chat--${this.chatPrefix}__modal`)
      .classList.remove('tw-chat--avaya-chat__modal-logon');

    this.isInChatMode = true;
    hideElement('avaya-chat__back-button');
    hideElement('chat-page');
    showElement('chat-form__minimize-button');
  }

  /**
   * Chat the dialog to Logon mode.
   */
  changeToLogonMode() {
    sendDebugMessage('Running AvayaChatUserInterface:changeToLogonMode');
    document
      .querySelector(`.tw-chat--${this.chatPrefix}__modal`)
      .classList.add('tw-chat--avaya-chat__modal-logon');

    this.isInChatMode = false;
    if (this.avayaChatConfig.isTriagePreChat) {
      showElement('avaya-chat__back-button');
    }
    showElement('chat-page');
    hideElement('chat-form__minimize-button');
  }

  /**
   * Clears the chatbox.
   */
  clearMessageInput() {
    sendDebugMessage('Running AvayaChatUserInterface:clearMessageInput');
    const avayaChatFrame = document.querySelector(`.tw-chat--${this.chatPrefix}__frame`);
    if (avayaChatFrame) {
      avayaChatFrame.innerHTML = DOMPurify.sanitize('');
    }
  }

  /**
   * Disable the form controls.
   *
   * @param shouldControlsBeDisabled
   */
  disableControls(shouldControlsBeDisabled) {
    sendDebugMessage('Running AvayaChatUserInterface:disableControls');
    const footerFormElements = document.querySelectorAll(
      `.tw-chat--${this.chatPrefix}__footer-form input, .tw-chat--${this.chatPrefix}__footer-form button`
    );
    Array.from(footerFormElements).forEach((footerFormElement) => {
      footerFormElement.disabled = shouldControlsBeDisabled;
    });
  }

  /**
   * Generates the Avaya Chat Backdrop
   *
   * @returns {HTMLDivElement}
   */
  // eslint-disable-next-line class-methods-use-this
  generateAvayaChatBackdrop() {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatBackdrop');
    const avayaChatBackdrop = document.createElement('div');
    avayaChatBackdrop.classList.add('tw-chat--tds-modal-backdrop');
    return avayaChatBackdrop;
  }

  /**
   * Handler for click eveent
   */
  handleBubbleClick() {
    hideElement('tw-chat--avaya-chat__button');
    this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.formInitiatedInteraction);

    const contentEmbeddedChatCTA = document.querySelector('#chatPageContentCTA');

    // submit form and start chat immediately if autoInitiate is true and isChatLite,
    // isWindowMinimized are false when press chat bubble
    if (
      contentEmbeddedChatCTA ||
      (this.avayaChatConfig.autoInitiate &&
        !this.avayaChatConfig.isChatLite &&
        !this.avayaChatConfig.isTriagePreChat &&
        !this.avayaChatConfig.isWindowMinimized)
    ) {
      const submitButton = document.querySelector(`.tw-chat--avaya-chat__form-button`);
      submitButton.click();
    }

    this.avayaChatConfig.isWindowMinimized = false;
  }

  /**
   * Generates the Avaya Chat Button
   *
   * @returns {HTMLButtonElement}
   */
  generateAvayaChatButton() {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatButton');
    const avayaChatButton = document.createElement('button');
    avayaChatButton.setAttribute('type', 'button');
    avayaChatButton.setAttribute('data-tds-open-modal', this.modalId);
    avayaChatButton.setAttribute(
      'aria-label',
      this.avayaChatConfig.initializers.ariaLabelChatButton
    );
    avayaChatButton.classList.add(`tw-chat--${this.chatPrefix}__button`);
    avayaChatButton.classList.add(`tw-chat--${this.chatPrefix}__animated_button`);
    avayaChatButton.setAttribute('id', `tw-chat--${this.chatPrefix}__animated_button`);

    // Detect if button needs additional positioning
    if (this.currentPage && this.pagesUpdatePosition.includes(this.currentPage)) {
      avayaChatButton.classList.add(`tw-chat--position__${this.currentPage}`);
    }

    if (this.avayaChatConfig.isChatLite === false) {
      avayaChatButton.style.display = 'none';
    } else {
      this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.impressionInteraction);
    }

    avayaChatButton.addEventListener('click', () => {
      this.handleBubbleClick();
      addGIOEvent(this.avayaChatConfig.locale, GIO_EVENTS.TRACK, GIO_EVENT_TYPES.CHAT_CLICK, {
        web_chat_button_name: this.avayaChatConfig.initializers?.ariaLabelChatButton,
      });
    });

    const avayaChatSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    AvayaChatUserInterface.setAttributes(avayaChatSvg, {
      xmlns: 'http://www.w3.org/2000/svg',
    });
    avayaChatSvg.classList.add(`tw-chat--tds-icon`);
    avayaChatSvg.classList.add(`tw-chat--avaya-chat__bubble_icon`);

    const avayaChatSvgPathOne = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    avayaChatSvgPathOne.setAttribute(
      'd',
      'M19.5 4h-15A2.5 2.5 0 0 0 2 6.5v9A2.5 2.5 0 0 0 4.5 18H7v2.07a.928.928 0 0 0 1.507.725l3.22-2.576A1 1 0 0 1 12.35 18h7.15a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 19.5 4zm1 11.5a1 1 0 0 1-1 1h-7.15a2.5 2.5 0 0 0-1.56.548L8.5 18.879V17a.5.5 0 0 0-.5-.5H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h15c.551 0 1 .449 1 1v9zM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'
    );
    avayaChatSvg.append(avayaChatSvgPathOne);
    avayaChatButton.append(avayaChatSvg);

    return avayaChatButton;
  }

  /**
   * Generates the Avaya Chat Dialog (Modal)
   *
   * @returns {HTMLDialogElement}
   */
  generateAvayaChatDialog() {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatDialog');
    const avayaChatDialog = document.createElement('dialog');
    avayaChatDialog.classList.add(
      'tw-chat--tds-modal',
      'tw-chat--tds-scrim--white',
      `tw-chat--${this.chatPrefix}__modal`
    );
    avayaChatDialog.id = this.modalId;

    const avayaChatDialogHeader = document.createElement('header');
    avayaChatDialogHeader.classList.add(
      'tw-chat--tds-modal-header',
      `tw-chat--${this.chatPrefix}__modal-header`
    );

    const avayaChatButtonContainer = document.createElement('div');
    avayaChatButtonContainer.style.width = '30px';

    const avayaChatBackButton = document.createElement('button');
    avayaChatBackButton.classList.add(`tw-chat--${this.chatPrefix}__back-button`);
    avayaChatBackButton.setAttribute('id', `avaya-chat__back-button`);
    avayaChatBackButton.setAttribute(
      'aria-label',
      this.avayaChatConfig.initializers.ariaLabelBackButton
    );

    const avayaChatBackButtonArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    avayaChatBackButtonArrow.classList.add('tw-chat--tds-icon', 'tw-chat--tds-chevron--right');
    AvayaChatUserInterface.setAttributes(avayaChatBackButtonArrow, {
      viewBox: '0 0 30 30',
      xmlns: 'http://www.w3.org/2000/svg',
    });

    const avayaChatBackButtonArrowPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    AvayaChatUserInterface.setAttributes(avayaChatBackButtonArrowPath, {
      stroke: 'var(--tds-icon--fill, #171a20)',
      'stroke-width': '2',
      d: 'M10.5 17.5l4.5-4 4.5 4',
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      transform: 'rotate(270 15 15)',
    });
    avayaChatBackButtonArrow.append(avayaChatBackButtonArrowPath);
    avayaChatBackButton.append(avayaChatBackButtonArrow);

    if (!this.avayaChatConfig.bypassChatBubble) {
      const avayaChatMinimizeButton = document.createElement('button');
      avayaChatMinimizeButton.classList.add(`tw-chat--${this.chatPrefix}__minimize-button`);
      AvayaChatUserInterface.setAttributes(avayaChatMinimizeButton, {
        'aria-label': this.avayaChatConfig.initializers.ariaLabelMinimizeModal,
        id: 'chat-form__minimize-button',
      });

      const avayaChatMinimizeButtonSvg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      avayaChatMinimizeButtonSvg.classList.add('tw-chat--tds-icon');
      AvayaChatUserInterface.setAttributes(avayaChatMinimizeButtonSvg, {
        fill: 'none',
        viewBox: '0 0 30 30',
        xmlns: 'http://www.w3.org/2000/svg',
      });

      const avayaChatMinimizeButtonSvgPath = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
      );
      AvayaChatUserInterface.setAttributes(avayaChatMinimizeButtonSvgPath, {
        d:
          'm22.34119,15.21793c0,0.41406 -0.4703,0.75 -1.05,0.75l-11.9,0c-0.57969,0 -1.05,-0.33594 -1.05,-0.75c0,-0.41406 0.47031,-0.75 1.05,-0.75l11.9,0c0.5797,0 1.05,0.33594 1.05,0.75z',
        fill: '#171A20',
      });
      avayaChatMinimizeButtonSvg.append(avayaChatMinimizeButtonSvgPath);
      avayaChatMinimizeButton.append(avayaChatMinimizeButtonSvg);

      avayaChatMinimizeButton.addEventListener('click', () => {
        this.avayaChatConfig.isWindowMinimized = true;
        closeModal(this.avayaChatDialog);
      });

      avayaChatMinimizeButton.style.display = 'none';

      avayaChatButtonContainer.append(avayaChatMinimizeButton);
    }

    avayaChatButtonContainer.append(avayaChatBackButton);

    const avayaChatHeaderTextContainer = document.createElement('div');
    avayaChatHeaderTextContainer.classList.add('tw-chat--avaya-header-container');

    const avayaChatHeaderText = document.createElement('span');
    avayaChatHeaderText.classList.add('tw-chat--avaya-header-text');
    avayaChatHeaderText.innerHTML = DOMPurify.sanitize(
      this.avayaChatConfig.initializers.questionCenterHeader
    );

    const avayaChatSubHeaderText = document.createElement('span');
    avayaChatSubHeaderText.classList.add('tw-chat--avaya-subheader-text');
    avayaChatSubHeaderText.innerHTML = DOMPurify.sanitize(
      this.avayaChatConfig.initializers.teslaAdvisor
    );
    avayaChatSubHeaderText.style.display = 'none';

    avayaChatHeaderTextContainer.append(avayaChatHeaderText);
    avayaChatHeaderTextContainer.append(avayaChatSubHeaderText);

    const avayaChatCloseButton = document.createElement('button');
    AvayaChatUserInterface.setAttributes(avayaChatCloseButton, {
      'aria-label': this.avayaChatConfig.initializers.ariaLabelCloseModal,
      type: 'button',
    });

    avayaChatCloseButton.classList.add(`tw-chat--${this.chatPrefix}__modal-close`);
    avayaChatCloseButton.addEventListener('click', () => {
      if (this.isInChatMode) {
        if (this.chatWasClosedByAgent) {
          this.resetChat();
          this.resetChatUserInterface();
        } else if (this.avayaChatConfig.sessionWasTransferred) {
          closeModal(this.avayaChatDialog);
          this.hideChatButton();
        } else {
          this.writeEndChatQuestionMessage();
        }
      } else {
        closeModal(this.avayaChatDialog);
      }
    });

    const avayaChatIconCloseSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    avayaChatIconCloseSvg.classList.add('tw-chat--tds-icon');
    AvayaChatUserInterface.setAttributes(avayaChatIconCloseSvg, {
      fill: 'none',
      viewBox: '0 0 34 34',
      xmlns: 'http://www.w3.org/2000/svg',
    });

    const avayaChatIconCloseSvgPath = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    AvayaChatUserInterface.setAttributes(avayaChatIconCloseSvgPath, {
      d:
        'M 23.589 23.09 C 23.896 23.393 23.896 23.882 23.589 24.185 C 23.436 24.336 23.235 24.412 23.034 24.412 C 22.833 24.412 22.632 24.336 22.48 24.185 L 16.754 18.536 L 11.03 24.185 C 10.876 24.336 10.676 24.412 10.474 24.412 C 10.273 24.412 10.073 24.336 9.919 24.185 C 9.613 23.882 9.613 23.393 9.919 23.09 L 15.644 17.44 L 9.919 11.788 C 9.613 11.486 9.613 10.996 9.919 10.694 C 10.226 10.391 10.723 10.391 11.03 10.694 L 16.754 16.344 L 22.48 10.694 C 22.786 10.391 23.282 10.391 23.589 10.694 C 23.896 10.996 23.896 11.486 23.589 11.788 L 17.864 17.44 L 23.589 23.09 Z',
      fill: '#171A20',
    });

    avayaChatIconCloseSvg.append(avayaChatIconCloseSvgPath);
    avayaChatCloseButton.append(avayaChatIconCloseSvg);

    avayaChatCloseButton.addEventListener('click', () => {
      let gaTagPostfix = '';
      if (this.avayaChatConfig.isTriagePreChat) {
        gaTagPostfix = this.userInterfaceEvents.history[
          this.userInterfaceEvents.history.length - 1
        ];
      }
      this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.exitInteraction, gaTagPostfix);
    });

    avayaChatDialogHeader.append(avayaChatButtonContainer);
    avayaChatDialogHeader.append(avayaChatHeaderTextContainer);
    avayaChatDialogHeader.append(avayaChatCloseButton);

    avayaChatDialog.append(avayaChatDialogHeader);

    const avayaChatDialogContent = document.createElement('section');
    avayaChatDialogContent.classList.add(
      'tw-chat--tds-modal-content',
      `tw-chat--${this.chatPrefix}__modal-content`
    );

    const avayaChatForm = this.generateAvayaChatForm();
    avayaChatDialogContent.append(avayaChatForm);

    if (this.avayaChatConfig.isTriagePreChat) {
      avayaChatDialogContent.append(
        this.getAvayaChatTopics(
          'main-topics',
          this.avayaChatConfig.triageConfig.chooseTopic,
          this.avayaChatConfig.triageConfig.teslaProducts,
          this.avayaChatConfig.triageConfig.chooseTopicSubtext
        )
      );

      avayaChatDialogContent.append(this.getAvayaChatVehicleDeliveryFAQ());
    }

    const avayaChatFrame = this.generateAvayaChatFrame();
    Array.from(avayaChatFrame.childNodes).forEach((child) => {
      avayaChatDialogContent.append(child);
    });

    const loader = this.generateLoader();
    avayaChatDialogContent.append(loader);
    avayaChatDialog.append(avayaChatDialogContent);

    const statusPopUp = this.generateStatusPopUp();
    avayaChatDialog.append(statusPopUp);

    return avayaChatDialog;
  }

  /**
   * Generates the Avaya Chat Loader
   *
   * @returns {HTMLDialogElement}
   */
  // eslint-disable-next-line class-methods-use-this
  generateLoader() {
    const avayaLoader = document.createElement('div');
    avayaLoader.classList.add('tw-chat--tds-loader', 'tw-chat--avaya-chat-loader');
    AvayaChatUserInterface.setAttributes(avayaLoader, {
      'aria-busy': true,
      'aria-hidden': false,
      'aria-label': this.avayaChatConfig.initializers.ariaLabelLoading,
      'aria-live': 'polite',
    });

    const avayaLoaderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    avayaLoaderSvg.classList.add('tw-chat--tds-icon', 'tw-chat--tds-icon-loader');
    AvayaChatUserInterface.setAttributes(avayaLoaderSvg, {
      viewBox: '0 0 51 51',
      xmlns: 'http://www.w3.org/2000/svg',
    });

    const avayaLoaderClipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    AvayaChatUserInterface.setAttributes(avayaLoaderClipPath, {
      transform: 'translate(-44.5 -44.5)',
      id: 'tw-chat--tds-loader-clip-path',
      xmlns: 'http://www.w3.org/2000/svg',
    });

    const avayaLoaderPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    AvayaChatUserInterface.setAttributes(avayaLoaderPath, {
      fill: 'none',
      d:
        'M70 45.5a2.5 2.5 0 010 5 19.5 19.5 0 1014.23 6.17 2.5 2.5 0 113.65-3.42A24.5 24.5 0 1170 45.5z',
    });

    const avayaLoaderImage = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    AvayaChatUserInterface.setAttributes(avayaLoaderImage, {
      width: 51,
      height: 51,
      'clip-path': 'url(#tw-chat--tds-loader-clip-path)',
      href:
        'data:image/png;base64,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',
    });

    avayaLoaderClipPath.append(avayaLoaderPath);

    avayaLoaderSvg.append(avayaLoaderClipPath);
    avayaLoaderSvg.append(avayaLoaderImage);

    const avayaLoaderSvgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    avayaLoaderSvgIcon.classList.add('tw-chat--tds-icon', 'tw-chat--tds-icon-logo');
    AvayaChatUserInterface.setAttributes(avayaLoaderSvgIcon, {
      viewBox: '0 0 160 160',
      xmlns: 'http://www.w3.org/2000/svg',
    });

    const avayaLoaderSvgIconG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    AvayaChatUserInterface.setAttributes(avayaLoaderSvgIconG, {
      transform: 'translate(30 30)',
      fill: 'var(--tds-icon--fill, #171a20)',
    });

    const avayaLoaderSvgIconPathOne = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    AvayaChatUserInterface.setAttributes(avayaLoaderSvgIconPathOne, {
      d:
        'M50 99.8l14-78.7c13.3 0 17.5 1.5 18.1 7.4 0 0 8.9-3.3 13.5-10.1C78 10.3 60.3 9.9 60.3 9.9L50 22.5 39.7 9.9s-17.7.4-35.3 8.5c4.5 6.8 13.5 10.1 13.5 10.1.6-6 4.8-7.4 18.1-7.4l14 78.7z',
    });

    const avayaLoaderSvgIconPathTwo = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    AvayaChatUserInterface.setAttributes(avayaLoaderSvgIconPathTwo, {
      d:
        'M50 6.3c14.2-.1 30.5 2.2 47.2 9.5 2.2-4 2.8-5.8 2.8-5.8C81.8 2.7 64.7.3 50 .2 35.3.3 18.2 2.7 0 10c0 0 .8 2.2 2.8 5.8 16.7-7.3 33-9.6 47.2-9.5z',
    });

    avayaLoaderSvgIconG.append(avayaLoaderSvgIconPathOne);
    avayaLoaderSvgIconG.append(avayaLoaderSvgIconPathTwo);

    avayaLoaderSvgIcon.append(avayaLoaderSvgIconG);

    avayaLoader.append(avayaLoaderSvg);
    avayaLoader.append(avayaLoaderSvgIcon);

    return avayaLoader;
  }

  /**
   * Shows the chat loader.
   */
  showLoader() {
    const avayaChatLoader = document.querySelector(`.tw-chat--tds-loader`);
    if (avayaChatLoader) {
      avayaChatLoader.classList.add('tw-chat--tds-loader--show');
    }
    this.loaderTimeout = setTimeout(() => {
      this.showStatusPopUp(false, true);
      this.changeToLogonMode();
      this.hideLoader();
      this.resetChat();
    }, this.avayaChatConfig.maxWaitTime * 1000);
  }

  /**
   * Hides the chat loader.
   */
  hideLoader() {
    const avayaChatLoader = document.querySelector(`.tw-chat--tds-loader`);
    if (avayaChatLoader) {
      avayaChatLoader.classList.remove('tw-chat--tds-loader--show');
    }
    window.clearTimeout(this.loaderTimeout);
  }

  /**
   * Generates the Avaya Chat Logon Form
   *
   * @returns {HTMLDivElement}
   */
  generateAvayaChatForm() {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatForm');
    const { isTriagePreChat, isChatLite } = this.avayaChatConfig;

    const avayaChatFormWrapper = document.createElement('div');
    avayaChatFormWrapper.setAttribute('id', 'chat-page');
    avayaChatFormWrapper.classList.add(`tw-chat--full-height-screen`);

    if (isTriagePreChat) {
      avayaChatFormWrapper.style.display = 'none';
    }

    const avayaChatForm = document.createElement('form');

    // disable google ''Please Fill out This Field" suggestions
    avayaChatForm.setAttribute('novalidate', 'novalidate');
    avayaChatForm.classList.add(
      'tw-chat--tds-form-fieldset',
      `tw-chat--${this.chatPrefix}__modal-form`
    );

    const {
      formDetails: { disablePrefilledInputs, chatLiteForm, preEngagementForm },
      callBackFormConfig,
      preEngagementConfig,
    } = this.avayaChatConfig;

    const formConfig = isChatLite ? callBackFormConfig : preEngagementConfig;
    const { fields = {}, submitLabel, description = null } = formConfig;

    // Only CN needs to handle these two fields
    if (isCN()) {
      const isLocationForm =
        fields.filter(function (item) {
          return ['city', 'province'].includes(item.attributes.name);
        }).length > 0;
      if (isLocationForm) {
        getCountryData().then((response) => {
          const { provinceList, cityList } = response.data;
          if (provinceList) {
            this.provinceList = provinceList;
          }
          if (cityList) {
            this.cityList = cityList;
          }
          this.handleSelectOptions();
        });
      }
    }

    const formPrefilledValues = (isChatLite ? chatLiteForm : preEngagementForm) || {};

    const avayaChatFormHeaderBlock = document.createElement('div');
    avayaChatFormHeaderBlock.classList.add(`tw-chat--${this.chatPrefix}__topic-header-container`);

    if (!isChatLite) {
      const avayaChatFormPoliteRequest = document.createElement('h6');
      avayaChatFormPoliteRequest.classList.add(`tw-chat--${this.chatPrefix}__topic-header`);
      avayaChatFormPoliteRequest.innerHTML = DOMPurify.sanitize(
        this.avayaChatConfig.initializers.headerSubtext
      );
      avayaChatFormHeaderBlock.append(avayaChatFormPoliteRequest);
    }

    if (description) {
      const avayaChatFormSubHeader = document.createElement('p');
      avayaChatFormSubHeader.classList.add(`tw-chat--${this.chatPrefix}__topic-sub-heading`);
      avayaChatFormSubHeader.innerHTML = DOMPurify.sanitize(description);
      avayaChatFormHeaderBlock.append(avayaChatFormSubHeader);
    }

    avayaChatFormWrapper.append(avayaChatFormHeaderBlock);

    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === 'InputItem') {
        let defaultValue =
          fields[i].attributes.name in formPrefilledValues
            ? formPrefilledValues[fields[i].attributes.name]
            : null;

        if (fields[i].attributes.name === 'phone' || fields[i].attributes.name === 'phoneNumber') {
          defaultValue =
            typeof formPrefilledValues['phone'] === 'string' ? formPrefilledValues['phone'] : null;
          if (typeof formPrefilledValues['phone'] === 'string') {
            defaultValue = formPrefilledValues['phone'];
          } else if (typeof formPrefilledValues['phone'] === 'object') {
            defaultValue = formPrefilledValues['phone'].number;
          } else {
            defaultValue = '';
          }
        }

        avayaChatForm.append(
          this.generateAvayaChatFormTextItem(
            fields[i].attributes.name,
            fields[i].label,
            fields[i].attributes.required,
            '',
            fields[i].attributes.type,
            defaultValue,
            disablePrefilledInputs
          )
        );
      } else if (fields[i].type === 'SelectItem') {
        const optionsArr = [];

        for (let j = 0; j < fields[i].options.length; j++) {
          if (fields[i].attributes.name === 'getUpdates') {
            optionsArr.push({
              fieldName: fields[i].options[j].value,
              fieldLabel: fields[i].options[j].label,
              selected: flag.optOutNewsletter
                ? !fields[i].options[j].selected
                : fields[i].options[j].selected,
            });
          } else {
            optionsArr.push({
              fieldName: fields[i].options[j].value,
              fieldLabel: fields[i].options[j].label,
              selected: fields[i].options[j].selected,
            });
          }
        }

        avayaChatForm.append(
          this.generateAvayaChatFormSelectItem(
            fields[i].attributes.name,
            fields[i].label,
            fields[i].attributes.required,
            optionsArr
          )
        );
      } else if (fields[i].type === 'CheckboxItem') {
        avayaChatForm.append(
          AvayaChatUserInterface.generateAvayaChatFormCheckboxItem(
            fields[i].attributes.name,
            fields[i].label,
            fields[i].options,
            fields[i].attributes.required
          )
        );
      }
    }

    const avayaChatFormButton = document.createElement('button');
    avayaChatFormButton.classList.add(
      'tw-chat--tds-btn',
      'tw-chat--tds-btn--blue',
      `tw-chat--${this.chatPrefix}__form-button`
    );
    avayaChatFormButton.setAttribute('type', 'submit');
    avayaChatFormButton.innerText = submitLabel;

    avayaChatForm.append(avayaChatFormButton);

    const formHelper = new FormHelper(
      avayaChatForm,
      formConfig,
      this.onChatFormSubmit,
      this.avayaChatConfig
    );

    formHelper.init();

    avayaChatFormWrapper.append(avayaChatForm);

    return avayaChatFormWrapper;
  }

  /**
   * Generates the Avaya chat status pop up
   *
   * @returns {HTMLElement}
   */
  generateStatusPopUp() {
    const {
      statusCardSuccessHeader,
      statusCardSuccessText,
      statusCardErrorHeader,
      statusCardErrorText,
    } = this.avayaChatConfig.initializers;

    sendDebugMessage('Running AvayaChatUserInterface:generateChatLitePopUp');
    const avayaCanvasTray = document.createElement('div');
    avayaCanvasTray.classList.add('tw-chat--tds-card', `tw-chat--${this.chatPrefix}__status-card`);

    avayaCanvasTray.style.position = 'relative';
    avayaCanvasTray.style.minHeight = 108;
    avayaCanvasTray.style.left = 0;
    avayaCanvasTray.style.bottom = 0;
    avayaCanvasTray.style.display = 'none';

    const avayaCanvasTrayBodySuccess = document.createElement('div');
    avayaCanvasTrayBodySuccess.classList.add(
      'tw-chat--tds-card-body',
      'tw-chat--tds-card-body-success',
      `tw-chat--${this.chatPrefix}__thank-you-body`
    );
    avayaCanvasTrayBodySuccess.style.display = 'none';

    const avayaCanvasTrayHeaderSuccess = document.createElement('h6');
    avayaCanvasTrayHeaderSuccess.classList.add(`tw-chat--${this.chatPrefix}__status-popup-header`);
    avayaCanvasTrayHeaderSuccess.innerText = statusCardSuccessHeader;

    const avayaCanvasTrayParagraphSuccess = document.createElement('p');
    avayaCanvasTrayParagraphSuccess.classList.add(`tw-chat--${this.chatPrefix}__status-popup-text`);
    avayaCanvasTrayParagraphSuccess.innerText = statusCardSuccessText;

    avayaCanvasTrayBodySuccess.append(avayaCanvasTrayHeaderSuccess);
    avayaCanvasTrayBodySuccess.append(avayaCanvasTrayParagraphSuccess);

    const avayaCanvasTrayBodyError = document.createElement('div');
    avayaCanvasTrayBodyError.classList.add(
      'tw-chat--tds-card-body',
      'tw-chat--tds-card-body-error'
    );
    avayaCanvasTrayBodyError.style.display = 'none';

    const avayaCanvasTrayHeaderError = document.createElement('h6');
    avayaCanvasTrayHeaderError.classList.add(`tw-chat--${this.chatPrefix}__status-popup-header`);
    avayaCanvasTrayHeaderError.innerText = statusCardErrorHeader;

    const avayaCanvasTrayParagraphError = document.createElement('p');
    avayaCanvasTrayParagraphError.classList.add(`tw-chat--${this.chatPrefix}__status-popup-text`);
    avayaCanvasTrayParagraphError.innerText = statusCardErrorText;

    avayaCanvasTrayBodyError.append(avayaCanvasTrayHeaderError);
    avayaCanvasTrayBodyError.append(avayaCanvasTrayParagraphError);

    avayaCanvasTray.append(avayaCanvasTrayBodySuccess);
    avayaCanvasTray.append(avayaCanvasTrayBodyError);

    return avayaCanvasTray;
  }

  /**
   * Generates the Avaya Chat Form Item
   *
   * @param fieldName
   * @param fieldLabel
   * @param required
   * @param errorMessage
   * @param type
   * @returns {HTMLDivElement}
   */
  generateAvayaChatFormItem(
    fieldName,
    fieldLabel,
    required,
    type = 'text',
    defaultValue = null,
    disableField = false
  ) {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatFormItem');
    // let formItemType = type;

    // if (type === 'email') {
    //   formItemType = 'text';
    // }
    const avayaChatFormItem = document.createElement('div');
    avayaChatFormItem.classList.add(
      'tw-chat--tds-form-item',
      // `tw-chat--tds-form-item--${formItemType}`,
      `tw-chat--${this.chatPrefix}__form-item`
    );

    if (this.avayaChatConfig.countryCode === 'CN') {
      if (!this.avayaChatConfig.isChatLite && type === 'email' && disableField) {
        avayaChatFormItem.classList.add('tds--is_hidden');
      }
      if (this.avayaChatConfig.isChatLite && fieldName === 'zip') {
        avayaChatFormItem.classList.add('tds--is_hidden');
      }
    }

    const avayaChatFormItemLabelWrap = document.createElement('div');
    avayaChatFormItemLabelWrap.classList.add('tw-chat--tds-form-label');

    const avayaChatFormItemLabel = document.createElement('label');
    avayaChatFormItemLabel.setAttribute('for', fieldName);
    avayaChatFormItemLabel.classList.add('tw-chat--tds-form-label-text');
    avayaChatFormItemLabelWrap.append(avayaChatFormItemLabel);

    const avayaChatFormItemLabelText = document.createElement('span');
    avayaChatFormItemLabelText.classList.add(
      'tw-chat--tds-form-label-text',
      'tw-chat--tds-text--600'
    );

    // we need to use different parentheses for some of the APAC countries
    const parentheses = ['TW', 'HK', 'MO', 'CN'].includes(this.avayaChatConfig.countryCode)
      ? ['（', '）']
      : [' (', ') '];

    const labelForField = required
      ? fieldLabel
      : `${fieldLabel}${parentheses[0]}${this.avayaChatConfig.initializers.optionalField}${parentheses[1]}`;

    const fieldLabelAsNode = document.createTextNode(labelForField);
    avayaChatFormItemLabelText.append(fieldLabelAsNode);

    avayaChatFormItemLabel.append(avayaChatFormItemLabelText);

    if (type === 'text' || type === 'email') {
      const tdsTextInputWrapper = document.createElement('div');
      tdsTextInputWrapper.classList.add(
        'tw-chat--tds-form-input',
        'tw-chat--tds-form-input--default'
      );

      const tdsTextInput = document.createElement('input');
      tdsTextInput.classList.add('tw-chat--tds-form-input-text');

      const tdsTextInputAttributes = {
        id: fieldName,
        name: fieldName,
        type,
      };

      if (required) {
        tdsTextInputAttributes.required = '';
      }

      if (defaultValue != null) {
        tdsTextInputAttributes.value = defaultValue;

        if (disableField) {
          tdsTextInputAttributes.readonly = '';
        }
      }

      AvayaChatUserInterface.setAttributes(tdsTextInput, tdsTextInputAttributes);
      tdsTextInputWrapper.append(tdsTextInput);

      avayaChatFormItem.append(avayaChatFormItemLabelWrap);
      avayaChatFormItem.append(tdsTextInputWrapper);

      const tdsFormFeedbackWrap = document.createElement('div');
      tdsFormFeedbackWrap.classList.add('tw-chat--tds-form-feedback-wrap');
      let tdsFormItemFeedback = document.createElement('div');
      tdsFormItemFeedback.classList.add(
        'tw-chat--tds-form-feedback',
        `tw-chat--${this.chatPrefix}__form-item-feedback`
      );

      const formFeedback = document.createElement('div');
      formFeedback.classList.add('tw-chat--tds-form-feedback-text');
      tdsFormItemFeedback.appendChild(formFeedback);

      tdsFormFeedbackWrap.append(tdsFormItemFeedback);
      avayaChatFormItem.append(tdsFormFeedbackWrap);
    }

    if (type === 'select') {
      const tdsSelect = document.createElement('div');
      tdsSelect.classList.add('tw-chat--tds-form-input', 'tw-chat--tds-form-input--default');

      const tdsSelectInput = document.createElement('select');
      tdsSelectInput.classList.add('tw-chat--tds-form-input-select');

      const tdsSelectInputAttributes = {
        id: fieldName,
        name: fieldName,
      };

      if (isCN() && required) {
        tdsSelectInputAttributes.required = '';
      }

      AvayaChatUserInterface.setAttributes(tdsSelectInput, tdsSelectInputAttributes);

      const tdsFormInputTrailing = document.createElement('div');
      tdsFormInputTrailing.classList.add('tw-chat--tds-form-input-trailing');

      const tdsSelectArrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      tdsSelectArrow.classList.add(
        'tw-chat--tds-icon',
        'tw-chat--tds-icon--inline',
        'tw-chat--tds-icon-arrow'
      );
      AvayaChatUserInterface.setAttributes(tdsSelectArrow, {
        viewBox: '0 0 30 30',
        xmlns: 'http://www.w3.org/2000/svg',
      });

      const tdsSelectArrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      AvayaChatUserInterface.setAttributes(tdsSelectArrowPath, {
        stroke: 'var(--tds-icon--fill, #171a20)',
        'stroke-width': '1.5',
        d: 'M10.5 17.5l4.5-4 4.5 4',
        fill: 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        transform: 'rotate(180 15 15)',
      });

      tdsSelectArrow.append(tdsSelectArrowPath);

      tdsFormInputTrailing.append(tdsSelectArrow);

      if (isCN()) {
        tdsSelectInput.addEventListener('change', (e) => this.handleSelectOptions(e.target));
      }

      tdsSelect.append(tdsSelectInput);
      tdsSelect.append(tdsFormInputTrailing);

      avayaChatFormItem.append(avayaChatFormItemLabelWrap);
      avayaChatFormItem.append(tdsSelect);

      if (isCN()) {
        const tdsFormFeedbackWrap = document.createElement('div');
        tdsFormFeedbackWrap.classList.add('tw-chat--tds-form-feedback-wrap');
        const tdsFormItemFeedback = document.createElement('div');
        tdsFormItemFeedback.classList.add(
          'tw-chat--tds-form-feedback-feedback',
          `tw-chat--${this.chatPrefix}__form-item-feedback`
        );
        tdsFormFeedbackWrap.append(tdsFormItemFeedback);
        avayaChatFormItem.append(tdsFormFeedbackWrap);
      }
    }

    return avayaChatFormItem;
  }

  /**
   * Generates the Avaya Chat Checkbox Group Item
   *
   * @param label
   * @param options
   * @returns {HTMLDivElement}
   */
  static generateAvayaChatFormCheckboxItem(name, label, options, required) {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatFormCheckboxItem');

    const fieldSet = document.createElement('fieldset');
    fieldSet.classList.add('tw-chat--tds-form-item');
    fieldSet.setAttribute('name', name);
    if (required) {
      fieldSet.setAttribute('required', '');
    }

    const legendElement = document.createElement('legend');
    legendElement.classList.add('tw-chat--tds-form-label');
    legendElement.innerHTML = DOMPurify.sanitize(label);

    fieldSet.appendChild(legendElement);

    const inputGroup = document.createElement('div');
    inputGroup.classList.add('tw-chat--tds-form-input-group');

    options.forEach((option) => {
      const formWrapper = document.createElement('div');
      formWrapper.classList.add('tw-chat--tds-form-input');

      const checkboxInput = document.createElement('input');
      checkboxInput.setAttribute('type', 'checkbox');
      checkboxInput.setAttribute('id', option.split(' ').join(''));
      checkboxInput.setAttribute('name', option);
      checkboxInput.classList.add('tw-chat--tds-form-input-choice');

      formWrapper.appendChild(checkboxInput);

      const labelOuterWrapper = document.createElement('div');
      labelOuterWrapper.classList.add('tds-form-input-choice-label');

      const labelWrapper = document.createElement('div');
      labelWrapper.classList.add('tw-chat--tds-form-label');

      const checkboxLabel = document.createElement('label');
      checkboxLabel.classList.add('tw-chat--tds-form-label-text');
      checkboxLabel.setAttribute('for', option.split(' ').join(''));
      checkboxLabel.innerHTML = DOMPurify.sanitize(option);

      labelWrapper.appendChild(checkboxLabel);
      labelOuterWrapper.appendChild(labelWrapper);
      formWrapper.appendChild(labelOuterWrapper);
      inputGroup.appendChild(formWrapper);
    });

    fieldSet.appendChild(inputGroup);

    const checkboxFeedbackWrap = document.createElement('div');
    checkboxFeedbackWrap.classList.add('tw-chat--tds-form-feedback-wrap');

    const checkboxFeedback = document.createElement('div');
    checkboxFeedback.classList.add('tw-chat--tds-form-feedback');

    checkboxFeedbackWrap.appendChild(checkboxFeedback);
    fieldSet.appendChild(checkboxFeedbackWrap);

    return fieldSet;
  }

  /**
   * Generates the Avaya Chat Select Item
   *
   * @param fieldName
   * @param fieldLabel
   * @param required
   * @param options
   * @returns {HTMLDivElement}
   */
  generateAvayaChatFormSelectItem(fieldName, fieldLabel, required, options) {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatFormSelectItem');
    const avayaChatFormSelectItem = this.generateAvayaChatFormItem(
      fieldName,
      fieldLabel,
      required,
      'select'
    );

    const tdsSelectInput = avayaChatFormSelectItem.querySelector(`#${fieldName}`);

    options.forEach((option) => {
      const optionElement = document.createElement('option');
      optionElement.setAttribute('value', option.fieldName);
      if (option.selected) {
        optionElement.setAttribute('selected', '');
      }
      optionElement.innerHTML = DOMPurify.sanitize(option.fieldLabel);
      tdsSelectInput.append(optionElement);
    });

    return avayaChatFormSelectItem;
  }

  /**
   * Generates the Avaya Chat Text Item
   *
   * @param fieldName
   * @param fieldLabel
   * @param required
   * @param placeholder
   * @param errorMessage
   * @param type
   * @returns {HTMLDivElement}
   */
  generateAvayaChatFormTextItem(
    fieldName,
    fieldLabel,
    required,
    placeholder,
    type = 'text',
    defaultValue = '',
    disableField = false
  ) {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatFormTextItem');
    const avayaChatFormTextItem = this.generateAvayaChatFormItem(
      fieldName,
      fieldLabel,
      required,
      type,
      defaultValue,
      disableField
    );

    const tdsTextInput = avayaChatFormTextItem.querySelector(`#${fieldName}`);
    tdsTextInput.setAttribute('placeholder', placeholder);

    if (required) {
      tdsTextInput.setAttribute('required', '');
    }

    return avayaChatFormTextItem;
  }

  /**
   * Generates the Avaya Chat Frame
   *
   * @returns {HTMLDivElement}
   */
  generateAvayaChatFrame() {
    sendDebugMessage('Running AvayaChatUserInterface:generateAvayaChatFrame');
    const { InputPlaceHolder } = this.avayaChatConfig.initializers;
    const avayaChatFrameWrapper = document.createElement('div');
    const avayaChatFrame = document.createElement('div');
    avayaChatFrame.classList.add(
      `tw-chat--${this.chatPrefix}__frame`,
      'tw-chat--full-height-screen'
    );

    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // scroll to the last message in chat frame when open or close keyboard on android,
    // because android doesn't do that automatically and covers last few messages with keyboard
    if (/android/i.test(userAgent)) {
      new ResizeObserver(() => {
        avayaChatFrame.scrollTo({
          top: avayaChatFrame.scrollHeight,
        });
      }).observe(avayaChatFrame);
    }

    const avayaChatFooter = document.createElement('footer');
    avayaChatFooter.classList.add(`tw-chat--${this.chatPrefix}__footer`);

    const avayaChatFooterForm = document.createElement('form');
    avayaChatFooterForm.classList.add(`tw-chat--${this.chatPrefix}__footer-form`);

    const footerFormItem = document.createElement('div');
    footerFormItem.classList.add(
      'tw-chat--tds-form-item',
      'tw-chat--tds-form-item--text',
      'tw-chat--avaya-chat__form-item'
    );

    const footerTextInputWrapper = document.createElement('div');
    // tds-form-input tds-form-input--default
    footerTextInputWrapper.classList.add(
      'tw-chat--tds-form-input',
      'tw-chat--tds-form-input--default'
    );
    footerTextInputWrapper.setAttribute(
      'aria-label',
      this.avayaChatConfig.initializers.ariaLabelMessageArea
    );

    const footerTextInput = document.createElement('input');
    footerTextInput.classList.add('tw-chat--tds-form-input-text');

    AvayaChatUserInterface.setAttributes(footerTextInput, {
      placeholder: InputPlaceHolder,
    });

    footerTextInput.addEventListener('input', (e) => {
      if (e.target.value.length > 0) {
        hideElement('send-icon-outline');
        showElement('send-icon-filled');
      } else {
        showElement('send-icon-outline');
        hideElement('send-icon-filled');
      }
    });

    const avayaChatIconSendSvgOutline = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    AvayaChatUserInterface.setAttributes(avayaChatIconSendSvgOutline, {
      width: '19',
      height: '19',
      viewBox: '0 0 19 19',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      id: 'send-icon-outline',
    });

    const avayaChatIconSendPathOutline = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    AvayaChatUserInterface.setAttributes(avayaChatIconSendPathOutline, {
      d:
        'M10.3594 18.4716L7.99997 11L0.632031 8.64231C-0.039949 8.42722 -0.0702291 7.48772 0.586511 7.22982L17.4038 0.626745C18.0126 0.387685 18.6144 0.988175 18.3766 1.59752L11.7733 18.5184C11.516 19.1777 10.5726 19.1465 10.3594 18.4716ZM9.58107 11.0257L11.1493 15.9914L16.3558 2.64971L3.09626 7.85592L7.97617 9.41751L12.6896 5.96098C12.9202 5.79187 13.2081 6.07981 13.039 6.31042L9.58107 11.0257Z',
      fill: '#171A20',
    });

    avayaChatIconSendSvgOutline.append(avayaChatIconSendPathOutline);

    const avayaChatIconSendSvgFilled = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    AvayaChatUserInterface.setAttributes(avayaChatIconSendSvgFilled, {
      width: '19',
      height: '19',
      viewBox: '0 0 19 19',
      fill: 'none',
      xmlns: 'http://www.w3.org/2000/svg',
      id: 'send-icon-filled',
    });

    const avayaChatIconSendPathFilled = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'path'
    );
    AvayaChatUserInterface.setAttributes(avayaChatIconSendPathFilled, {
      d:
        'M11.7735 18.5184L18.3768 1.59752C18.6146 0.988175 18.0128 0.387685 17.404 0.626745L0.586755 7.22982C-0.0699849 7.48772 -0.0397049 8.42722 0.632275 8.64231L6.49954 10.5198C6.57471 10.5438 6.65684 10.531 6.72106 10.4851L12.3899 6.43595C12.5048 6.35388 12.6463 6.49543 12.5643 6.61032L8.51072 12.2853C8.46502 12.3492 8.45212 12.4309 8.47572 12.5059L10.3596 18.4716C10.5728 19.1465 11.5162 19.1777 11.7735 18.5184Z',
      fill: '#171A20',
    });

    avayaChatIconSendSvgFilled.style.display = 'none';
    avayaChatIconSendSvgFilled.append(avayaChatIconSendPathFilled);

    const footerButton = document.createElement('button');
    footerButton.classList.add(
      `tw-chat--${this.chatPrefix}__footer-button`,
      'tw-chat--tds-text_color--30',
      'tw-chat--tds-text--30'
    );
    footerButton.setAttribute('type', 'button');
    footerButton.setAttribute('aria-label', this.avayaChatConfig.initializers.ariaLabelSendButton);

    footerButton.append(avayaChatIconSendSvgOutline);
    footerButton.append(avayaChatIconSendSvgFilled);

    footerTextInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        footerButton.click();
      } else {
        this.onTyping();
      }
    });

    footerButton.addEventListener('click', () => {
      const text = footerTextInput.value;
      footerTextInput.value = '';
      showElement('send-icon-outline');
      hideElement('send-icon-filled');
      this.onChatFooterSubmit(text);
    });

    footerTextInputWrapper.append(footerTextInput);
    footerFormItem.append(footerTextInputWrapper);

    avayaChatFooterForm.append(footerFormItem);
    avayaChatFooterForm.append(footerButton);

    avayaChatFooter.append(avayaChatFooterForm);

    avayaChatFrameWrapper.append(avayaChatFrame);
    avayaChatFrameWrapper.append(avayaChatFooter);

    return avayaChatFrameWrapper;
  }

  /**
   * Hides the Avaya Chat Button
   *
   * @returns {HTMLDivElement}
   */
  hideChatButton() {
    sendDebugMessage('Running AvayaChatUserInterface:hideChatButton');
    const avayaChatButton = document.querySelector(`.tw-chat--${this.chatPrefix}__animated_button`);
    if (avayaChatButton) {
      avayaChatButton.style.display = 'none';
    }
  }

  /**
   * Initializes the Avaya Chat User Interface.
   */
  init() {
    sendDebugMessage('Running AvayaChatUserInterface:init');
    const avayaChatContainer = document.createElement('div');
    avayaChatContainer.classList.add(`tw-chat--${this.chatPrefix}-container`);
    const avayaChat = document.createElement('div');
    avayaChat.classList.add(`tw-chat--${this.chatPrefix}`);
    const avayaChatButton = this.generateAvayaChatButton();
    const avayaChatDialog = this.generateAvayaChatDialog();
    this.avayaChatDialog = avayaChatDialog;
    const avayaChatBackdrop = this.generateAvayaChatBackdrop();
    avayaChat.append(avayaChatButton);
    avayaChat.append(avayaChatDialog);
    avayaChat.append(avayaChatBackdrop);
    avayaChatContainer.append(avayaChat);
    document.body.append(avayaChatContainer);
    this.setupModalObserver(avayaChatDialog);
    initModals({ onCloseFinish: () => {}, onCloseStart: () => {} });
    avayaChatDialog.classList.add(`tw-chat--${this.chatPrefix}__modal-logon`);
  }

  /**
   * Checks if the Chat Button is visible.
   *
   * @returns {boolean}
   */
  isChatButtonVisible() {
    sendDebugMessage('Running AvayaChatUserInterface:isChatButtonVisible');
    let chatButtonIsVisible = false;
    const avayaChatButton = document.querySelector(`.tw-chat--${this.chatPrefix}__button`);
    if (
      avayaChatButton &&
      avayaChatButton.style &&
      avayaChatButton.style.display !== 'none' &&
      !avayaChatButton.classList.contains('tw-chat--avaya-chat__button-is-loading')
    ) {
      chatButtonIsVisible = true;
    }
    return chatButtonIsVisible;
  }

  /**
   * Checks if the modal is open.
   *
   * @returns {boolean}
   */
  isModalOpen() {
    sendDebugMessage('Running AvayaChatUserInterface:isModalOpen');
    let modalIsOpen = false;
    const modal = document.querySelector(`.tw-chat--${this.chatPrefix}__modal`);
    if (modal && modal.hasAttribute('open')) {
      modalIsOpen = true;
    }
    return modalIsOpen;
  }

  /**
   * Reload the chat panel after a refresh
   */
  reloadChatPanel() {
    sendDebugMessage('Running AvayaChatUserInterface:reloadChatPanel');
    console.debug('Reloading chat panel');
    openModal(this.avayaChatDialog);
    this.changeToChatMode();
  }

  removeIsTypingIndicator(removeAll, userName = '') {
    sendDebugMessage('Running AvayaChatUserInterface:removeIsTypingIndicator');

    if (removeAll || userName) {
      const chatMessages = document.querySelectorAll(
        `.tw-chat--${this.chatPrefix}__chat-message.tw-chat--chat-message--typing`
      );
      Array.from(chatMessages).forEach((chatMessage) => {
        if (
          removeAll ||
          (typeof chatMessage.dataset !== 'undefined' &&
            typeof chatMessage.dataset.userTyping !== 'undefined' &&
            chatMessage.dataset.userTyping === userName)
        ) {
          chatMessage.parentNode.removeChild(chatMessage);
        }
      });
    }
  }

  /**
   * Resets the chat modal.
   */
  resetChatUserInterface() {
    sendDebugMessage('Running AvayaChatUserInterface:resetChatUserInterface');

    closeModal(this.avayaChatDialog);

    // need timeout to avoid switching screens during dialog closing animation
    setTimeout(() => {
      this.resetHeader();
      this.changeToLogonMode();
      this.hideStatusPopUp();
      if (!this.avayaChatConfig.bypassChatBubble) {
        this.showChatButton();
      }
      this.clearMessageInput();
      this.endChatMessageVisible = false;
      this.chatWasClosedByAgent = false;

      if (this.avayaChatConfig.isTriagePreChat) {
        hideElement('vehicle-delivery-faq');
        hideElement('account-support-faq');
        hideElement('topics-vehicle');
        hideElement('chat-page');

        showElement('main-topics');
        this.userInterfaceEvents.resetHistory();
      }
    }, 500);
  }

  /**
   * Sets up the Modal observer.
   *
   * @param avayaChatDialog
   */
  setupModalObserver(avayaChatDialog) {
    sendDebugMessage('Running AvayaChatUserInterface:setupModalObserver');
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'open') {
          if (avayaChatDialog.hasAttribute('open')) {
            this.onModalOpen();
          } else {
            this.onModalClose();
          }
        }
      });
    });

    observer.observe(avayaChatDialog, {
      attributes: true, // configure it to listen to attribute changes
    });
  }

  /**
   * Disable all of the form inputs and buttons
   */
  // eslint-disable-next-line class-methods-use-this
  disableFormButtonAndInputs() {
    const elements = document.querySelectorAll(
      '.tw-chat--avaya-chat__modal-form .tw-chat--avaya-chat__form-button, .tw-chat--avaya-chat__modal-form .tw-chat--tds-form-input'
    );
    elements.forEach((elem) => {
      elem.setAttribute('disabled', '');
    });
  }

  /**
   * Hide status pop up.
   */
  hideStatusPopUp() {
    const chatLitePopUp = document.querySelector(`.tw-chat--${this.chatPrefix}__status-card`);
    if (chatLitePopUp) {
      chatLitePopUp.style.display = 'none';
    }

    // adjust padding of the frame to make messages that are behind the popup visible, scroll to the last message
    const modalForm = document.querySelector(`.tw-chat--${this.chatPrefix}__modal-content`);

    if (modalForm) {
      modalForm.style.paddingBottom = '24px';
      modalForm.scrollTo({
        top: modalForm.scrollHeight,
      });
    }
  }

  /**
   * Shows the chat status pop up with different content based on the success parameter.
   */
  showStatusPopUp(success = true, hideMessage = false) {
    sendDebugMessage('Running AvayaChatUserInterface:showStatusPopUp');
    window.clearTimeout(this.statusMessageTimeout);

    const chatLitePopUpSuccessMessage = document.querySelector(`.tw-chat--tds-card-body-success`);
    const chatLitePopUpErrorMessage = document.querySelector(`.tw-chat--tds-card-body-error`);

    if (chatLitePopUpSuccessMessage && chatLitePopUpErrorMessage) {
      if (success) {
        chatLitePopUpErrorMessage.style.display = 'none';
        chatLitePopUpSuccessMessage.style.display = '';
      } else {
        chatLitePopUpSuccessMessage.style.display = 'none';
        chatLitePopUpErrorMessage.style.display = '';
      }
    } else {
      // in case messages couldn't be found don't show empty pop up
      return;
    }

    const chatLitePopUp = document.querySelector(`.tw-chat--${this.chatPrefix}__status-card`);
    if (chatLitePopUp) {
      chatLitePopUp.style.display = '';
    }

    // adjust padding of the frame to make messages that are behind the popup visible, scroll to the last message
    const modalForm = document.querySelector(`.tw-chat--${this.chatPrefix}__modal-content`);

    if (modalForm) {
      modalForm.style.marginBottom = `${chatLitePopUp.offsetHeight}px`;
      modalForm.scrollTo({
        top: modalForm.scrollHeight,
      });
    }

    if (hideMessage) {
      this.statusMessageTimeout = setTimeout(() => {
        this.hideStatusPopUp();
      }, this.avayaChatConfig.statusCardShowTime);
    } else {
      hideElement('avaya-chat__back-button');
    }
  }

  /**
   * Shows the chat button.
   */
  showChatButton() {
    sendDebugMessage('Running AvayaChatUserInterface:showChatButton');

    if (!this.avayaChatConfig.capturedChatImpression) {
      this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.impressionInteraction);
      this.avayaChatConfig.capturedChatImpression = true;
    }

    const avayaChatButton = document.querySelector(`.tw-chat--${this.chatPrefix}__animated_button`);
    if (avayaChatButton) {
      avayaChatButton.classList.remove('tw-chat--avaya-chat__button-is-loading');
      avayaChatButton.style.display = '';
    }
  }

  /**
   * Switch chat button to loading.
   */
  switchChatButtonToLoading() {
    sendDebugMessage('Running AvayaChatUserInterface:switchChatButtonToLoading');
    const avayaChatButton = document.querySelector(`.tw-chat--${this.chatPrefix}__animated_button`);
    if (avayaChatButton) {
      avayaChatButton.classList.add('tw-chat--avaya-chat__button-is-loading');
    }
  }

  /**
   * Generates the Avaya Chat Logon Form
   *
   * @returns {HTMLDivElement}
   */
  getAvayaChatTopics(id, header, buttons, subHeader = '') {
    sendDebugMessage('Running AvayaChatUserInterface:getAvayaChatTopics');
    const avayaChatTopicsWrapper = document.createElement('div');
    avayaChatTopicsWrapper.classList.add(`tw-chat--small-height-screen`);
    avayaChatTopicsWrapper.setAttribute('id', id);

    const avayaChatScreenHeaderBlock = document.createElement('div');
    avayaChatScreenHeaderBlock.classList.add(`tw-chat--${this.chatPrefix}__topic-header-container`);

    const avayaChatHeading = document.createElement('h6');
    avayaChatHeading.classList.add(`tw-chat--${this.chatPrefix}__topic-header`);
    avayaChatHeading.setAttribute('id', 'chat-topics-heading');
    avayaChatHeading.innerHTML = DOMPurify.sanitize(header);
    avayaChatScreenHeaderBlock.append(avayaChatHeading);

    if (subHeader !== '') {
      const avayaChatSubHeading = document.createElement('p');
      avayaChatSubHeading.classList.add(`tw-chat--${this.chatPrefix}__topic-sub-heading`);
      avayaChatSubHeading.setAttribute('id', 'chat-topics-subheading');
      avayaChatSubHeading.innerHTML = DOMPurify.sanitize(subHeader);
      avayaChatScreenHeaderBlock.append(avayaChatSubHeading);
    }

    avayaChatTopicsWrapper.append(avayaChatScreenHeaderBlock);

    // Create buttons for screen
    const avayaChatTopics = this.createButtonElements('tesla-chat-topic', buttons, false);

    avayaChatTopicsWrapper.append(avayaChatTopics);

    avayaChatTopicsWrapper.style.display = 'none';

    return avayaChatTopicsWrapper;
  }

  // eslint-disable-next-line class-methods-use-this
  createButtonElements(containerName, elements) {
    const { locale } = this.avayaChatConfig;
    const { isEnergyPage } = this.avayaChatConfig;
    const divContainer = document.createElement('div');
    divContainer.setAttribute('id', `div-${containerName}`);
    divContainer.classList.add('tw-chat--tds-btn_group', 'tw-chat--tds-btn_group--vertical');

    let domElement = null;
    Object.entries(elements).forEach(([key, value]) => {
      if (key === 'account-support') {
        domElement = document.createElement('a');
        domElement.classList.add('tw-chat--tds-btn', 'tw-chat--avaya-topic-btn');
        domElement.setAttribute('id', `btn-${key}`);
        const localizedSupportURL = localizeUrl('/contactus', { locale, delimiter: '_' });
        domElement.setAttribute('href', localizedSupportURL);
        domElement.innerHTML = DOMPurify.sanitize(value);
      } else if (key === 'vehicle-upcoming-delivery' && !flag.showDeliveryOnTriage) {
        return;
      } else if (key === 'schedule-test-drive') {
        if (isEnergyPage === true) {
          return;
        }
        domElement = document.createElement('a');
        domElement.classList.add(
          'tw-chat--tds-btn',
          'tw-chat--avaya-topic-btn',
          'tw-chat--avaya-topic--event'
        );
        domElement.setAttribute('id', `btn-${key}`);
        const localizedDriveURL = localizeUrl('/drive', { locale, delimiter: '_' });
        domElement.setAttribute('href', localizedDriveURL);
        domElement.innerHTML = DOMPurify.sanitize(
          flag.demoDriveCopy ? value.demoDrive.label : value.label
        );
      } else {
        domElement = document.createElement('button');
        domElement.classList.add(
          'tw-chat--tds-btn',
          'tw-chat--avaya-topic-btn',
          'tw-chat--avaya-topic--event'
        );

        domElement.setAttribute('id', `btn-${key}`);
        domElement.setAttribute('data-target', `div-${key}-sub-topic`);
        domElement.innerHTML = DOMPurify.sanitize(value);
      }

      divContainer.append(domElement);
    });

    return divContainer;
  }

  getAvayaChatVehicleDeliveryFAQ() {
    sendDebugMessage('Running AvayaChatUserInterface:getAvayaChatVehicleDeliveryFAQ');
    const avayaChatDeliveryFAQWrapper = document.createElement('div');
    avayaChatDeliveryFAQWrapper.setAttribute('id', 'vehicle-delivery-faq');
    avayaChatDeliveryFAQWrapper.classList.add(`tw-chat--small-height-screen`);
    avayaChatDeliveryFAQWrapper.style.display = 'none';

    const avayaChatScreenHeaderBlock = document.createElement('div');
    avayaChatScreenHeaderBlock.classList.add(`tw-chat--${this.chatPrefix}__topic-header-container`);

    const avayaChatHeading = document.createElement('h6');
    avayaChatHeading.classList.add(`tw-chat--${this.chatPrefix}__topic-header`);
    avayaChatHeading.innerHTML = DOMPurify.sanitize(
      this.avayaChatConfig.triageConfig.vehicleDeliveryHeading
    );

    const avayaChatHeadingDescription = document.createElement('p');
    avayaChatHeadingDescription.classList.add(`tw-chat--${this.chatPrefix}__topic-sub-heading`);
    avayaChatHeadingDescription.innerHTML = DOMPurify.sanitize(
      this.avayaChatConfig.triageConfig.vehicleDeliveryDescription
    );

    avayaChatScreenHeaderBlock.append(avayaChatHeading);
    avayaChatScreenHeaderBlock.append(avayaChatHeadingDescription);

    const avayaChatVehicleDeliveryLink = document.createElement('a');
    avayaChatVehicleDeliveryLink.classList.add(
      'tw-chat--tds-btn',
      'tw-chat--tds-btn--secondary',
      'tw-chat--vehicle-delivery-login-btn'
    );

    avayaChatVehicleDeliveryLink.href = 'https://ts.la/app';
    avayaChatVehicleDeliveryLink.innerText = this.avayaChatConfig.triageConfig.vehicleDeliveryLoginLinkText;

    avayaChatVehicleDeliveryLink.addEventListener('click', () => {
      this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.goToAccountInteraction);
    });

    const avayaChatLinksHeading = document.createElement('div');
    avayaChatLinksHeading.classList.add(`tw-chat--${this.chatPrefix}__link-heading`);
    avayaChatLinksHeading.innerHTML = this.avayaChatConfig.triageConfig.additionalDeliveryHeading;

    avayaChatDeliveryFAQWrapper.append(avayaChatScreenHeaderBlock);
    avayaChatDeliveryFAQWrapper.append(avayaChatVehicleDeliveryLink);
    avayaChatDeliveryFAQWrapper.append(avayaChatLinksHeading);
    avayaChatDeliveryFAQWrapper.append(
      this.generateFAQLinks(
        'vehicle-delivery-links',
        this.avayaChatConfig.triageConfig.additionalDeliveryResources,
        '#'
      )
    );

    return avayaChatDeliveryFAQWrapper;
  }

  generateFAQLinks(containerName, associateLinks, needHelpUrl = null) {
    const { locale } = this.avayaChatConfig;

    const divContainer = document.createElement('div');
    divContainer.setAttribute('id', `div-${containerName}`);

    const ulContainer = document.createElement('ul');
    ulContainer.classList.add('tw-chat--ul-faq-links', 'tw-chat--tds-list');

    let listElement = null;
    let anchorElement = null;

    const FAQLinks = {
      afterTakingDelivery: '/support/after-taking-delivery',
      prepareForDelivery: '/support/delivery-day',
      whatToExpectOnDeliveryDay: '/support/taking-delivery',
    };

    Object.entries(associateLinks).forEach(([key, value]) => {
      listElement = document.createElement('li');
      anchorElement = document.createElement('a');
      anchorElement.classList.add('tw-chat--tds-link');
      anchorElement.target = '_blank';
      anchorElement.href = localizeUrl(FAQLinks[key], { locale, delimiter: '_' });
      anchorElement.innerText = value;

      anchorElement.addEventListener('click', () => {
        this.avayaAnalyticsHelper.fireEvent(
          this.avayaAnalyticsHelper.supportInteraction,
          FAQLinks[key]
        );
      });

      listElement.append(anchorElement);
      ulContainer.append(listElement);
    });

    divContainer.append(ulContainer);

    if (needHelpUrl !== null) {
      const divLinkHeading = document.createElement('p');
      divLinkHeading.classList.add('tw-chat--need-assistance-question');
      divLinkHeading.innerText = this.avayaChatConfig.triageConfig.cantFindAnswer;
      divContainer.append(divLinkHeading);

      // Create link for Can't find answer
      anchorElement = document.createElement('a');
      anchorElement.classList.add(
        'tw-chat--tds-link',
        'tw-chat--lnk-need-assistance',
        `${containerName}--lnk-need-assistance`
      );
      anchorElement.href = needHelpUrl;
      anchorElement.innerText = this.avayaChatConfig.triageConfig.needMoreAssistance;
      divContainer.append(anchorElement);

      anchorElement.addEventListener('click', () => {
        this.avayaAnalyticsHelper.fireEvent(this.avayaAnalyticsHelper.needAssistanceInteraction);
      });
    }

    return divContainer;
  }

  // eslint-disable-next-line class-methods-use-this
  switchHeaderToChatMode(displayName) {
    const avayaHeaderText = document.querySelector(`.tw-chat--avaya-header-text`);
    avayaHeaderText.innerHTML = DOMPurify.sanitize(displayName);

    const avayaSubheaderText = document.querySelector(`.tw-chat--avaya-subheader-text`);
    avayaSubheaderText.style.display = 'block';
  }

  resetHeader() {
    const avayaHeaderText = document.querySelector(`.tw-chat--avaya-header-text`);
    avayaHeaderText.innerHTML = DOMPurify.sanitize(
      this.avayaChatConfig.initializers.questionCenterHeader
    );

    const avayaSubheaderText = document.querySelector(`.tw-chat--avaya-subheader-text`);
    avayaSubheaderText.style.display = 'none';
  }

  writeChatBoxMessage(mainMessage = '', additionalMessage = '', closedByAgent = true) {
    const avayaChatFrame = document.querySelector(`.tw-chat--${this.chatPrefix}__frame`);
    if (avayaChatFrame) {
      const chatEndMessageContainer = document.createElement('div');
      chatEndMessageContainer.classList.add('tw-chat--chat-end-message-container');

      const chatEndMessageContent = document.createElement('div');
      chatEndMessageContent.classList.add('tw-chat--chat-end-message-content');

      const chatEndMessageMainText = document.createElement('p');
      chatEndMessageMainText.classList.add('tw-chat--chat-end-message-main');
      chatEndMessageMainText.innerText = mainMessage;

      const chatEndMessageAdditionalText = document.createElement('p');
      chatEndMessageAdditionalText.classList.add('tw-chat--chat-end-message-additional');
      chatEndMessageAdditionalText.innerText = additionalMessage;

      chatEndMessageContent.append(chatEndMessageMainText);
      chatEndMessageContent.append(chatEndMessageAdditionalText);

      chatEndMessageContainer.append(chatEndMessageContent);

      hideElement('chat-end-question-message');

      if (closedByAgent) {
        this.chatWasClosedByAgent = true;
      }

      avayaChatFrame.append(chatEndMessageContainer);

      avayaChatFrame.scrollTo({
        top: avayaChatFrame.scrollHeight,
      });
    }
  }

  writeEndChatQuestionMessage() {
    const avayaChatFrame = document.querySelector(`.tw-chat--${this.chatPrefix}__frame`);
    if (avayaChatFrame) {
      if (!this.endChatMessageVisible) {
        const chatEndMessageContainer = document.createElement('div');
        chatEndMessageContainer.classList.add('tw-chat--chat-end-message-container');
        chatEndMessageContainer.setAttribute('id', 'chat-end-question-message');

        const chatEndMessageContent = document.createElement('div');
        chatEndMessageContent.classList.add('tw-chat--chat-end-message-content');

        const chatEndMessageMainText = document.createElement('p');
        chatEndMessageMainText.classList.add('tw-chat--chat-end-message-main');
        chatEndMessageMainText.innerText = this.avayaChatConfig.initializers.endChatScreenMessage;

        const chatEndMessageButtons = document.createElement('div');
        chatEndMessageButtons.classList.add('tw-chat--chat-end-message-buttons');

        const closeScreenAnswerNo = document.createElement('button');
        closeScreenAnswerNo.classList.add(
          'tw-chat--tds-btn',
          'tw-chat--tds-btn--tertiary',
          'tw-chat--close-screen-btn'
        );
        closeScreenAnswerNo.innerText = this.avayaChatConfig.initializers.endChatScreenContinue;

        closeScreenAnswerNo.addEventListener('click', () => {
          const endChatMessage = document.getElementById('chat-end-question-message');
          if (endChatMessage) {
            endChatMessage.parentNode.removeChild(endChatMessage);
            this.endChatMessageVisible = false;
          }
        });

        const closeScreenAnswerYes = document.createElement('button');
        closeScreenAnswerYes.classList.add(
          'tw-chat--tds-btn',
          'tw-chat--tds-btn--tertiary',
          'tw-chat--close-screen-btn'
        );
        closeScreenAnswerYes.innerText = this.avayaChatConfig.initializers.endChatScreenEnd;

        closeScreenAnswerYes.addEventListener('click', () => {
          this.resetChat();
          this.resetChatUserInterface();
        });

        chatEndMessageButtons.append(closeScreenAnswerNo);
        chatEndMessageButtons.append(closeScreenAnswerYes);

        chatEndMessageContent.append(chatEndMessageMainText);
        chatEndMessageContent.append(chatEndMessageButtons);

        chatEndMessageContainer.append(chatEndMessageContent);

        this.endChatMessageVisible = true;
        avayaChatFrame.append(chatEndMessageContainer);
      }

      avayaChatFrame.scrollTo({
        top: avayaChatFrame.scrollHeight,
      });
    }
  }

  /**
   * Handler for select options for CN
   * Currently, this is only for CN chat form.
   */
  handleSelectOptions(obj = null) {
    if (!isCN()) {
      return;
    }

    // handle selected field
    if (obj && obj.id === 'city') {
      this.selectedCity = obj.value;
    } else if (obj && obj.id === 'province') {
      this.selectedProvince = obj.value;
      this.selectedCity = null;
    }

    // make preparation for the new data
    const divCity = document.querySelector('#city');
    const divProvince = document.querySelector('#province');
    if (!divCity && !divProvince) {
      return;
    }

    const updateSelectOptions = (element, options) => {
      element.innerHTML = null;
      options.forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.setAttribute('value', option.fieldName);
        if (option.selected) {
          optionElement.setAttribute('selected', '');
        }
        optionElement.innerHTML = option.fieldLabel;
        element.append(optionElement);
      });
    };
    const filterSelectOptions = (field) => {
      const isCity = field === 'city';
      const defaultFieldName = '';
      const defaultFieldLabel = isCity ? '市（区）' : '省份';
      const defaultSelected = isCity ? !!this.selectedCity : !!this.selectedProvince;
      const currentList = isCity ? this.cityList[this.selectedProvince] || [] : this.provinceList;
      const optionsArr = [];
      for (const currentItem in currentList) {
        const currentObj = {
          fieldName: isCity ? currentList[currentItem] : currentItem,
          fieldLabel: currentList[currentItem],
          selected: isCity
            ? currentList[currentItem] === this.selectedCity
            : currentItem === this.selectedProvince,
        };
        optionsArr.push(currentObj);
      }
      // add default item for options
      optionsArr.unshift({
        fieldName: defaultFieldName,
        fieldLabel: defaultFieldLabel,
        selected: defaultSelected,
      });
      return optionsArr;
    };

    updateSelectOptions(divProvince, filterSelectOptions('province'));
    updateSelectOptions(divCity, filterSelectOptions('city'));
  }
}

export default AvayaChatUserInterface;
