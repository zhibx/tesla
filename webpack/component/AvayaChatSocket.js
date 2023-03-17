import { clearLocalStorage, getLocalStorage, sendDebugMessage } from '../utils/AvayaChatUtils.js';

class AvayaChatSocket {
  constructor(
    avayaChatConfig,
    avayaChatUserInterface,
    avayaChatStore,
    writeResponse,
    handleNotification,
    addToTimeouts,
    chatLogin,
    clearRefresh,
    writeChatEnded,
    writeChatSessionTransferred
  ) {
    this.avayaChatConfig = avayaChatConfig;
    this.avayaChatUserInterface = avayaChatUserInterface;
    this.avayaChatStore = avayaChatStore;
    this.writeResponse = writeResponse;
    this.handleNotification = handleNotification;
    this.addToTimeouts = addToTimeouts;
    this.chatLogin = chatLogin;
    this.clearRefresh = clearRefresh;
    this.writeChatEnded = writeChatEnded;
    this.writeChatSessionTransferred = writeChatSessionTransferred;

    // authentication token for customer's firewall
    this.authToken = '';
    this.pingInterval = null;
  }

  /**
   * Handle the WebSocket closing.
   *
   * @param event
   * @param webChatUrl
   */
  handleClose(event, webChatUrl) {
    if (!event.wasClean) {
      // eslint-disable-next-line no-console
      console.warn(
        'WebChat: WebSocket closed abnormally. This may be caused by the user exiting before the chat starts or the agent closing the chat (in which case, ignore this), a certificate issue (e.g. your browser considers the certificate to be invalid), or an incorrect URL (e.g. not using a secure connection to a cluster that enforces secure connections). The URL is: ',
        webChatUrl
      );
    } else {
      // eslint-disable-next-line no-console
      console.info('WebChat: Closing the WebSocket.');
    }

    this.avayaChatUserInterface.disableControls(true);
    this.avayaChatStore.initCalled = false;
    this.avayaChatStore.users = {};

    // if the customer hasn't closed it manually and chat wasn't initiated, let them know.
    // otherwise, ignore the timer
    if (!this.avayaChatStore.manualClose && this.avayaChatStore.chatWasInitiated) {
      this.writeChatEnded();
      this.avayaChatUserInterface.removeIsTypingIndicator(true);
    } else {
      this.avayaChatStore.initCalled = false;
    }
  }

  /**
   * Handle WebSocket error.
   *
   * @param event
   */
  handleError(event) {
    sendDebugMessage('Running AvayaChatSocket:handleError');
    // eslint-disable-next-line no-console
    console.error('WebChat: WebSocket error', event);
    this.writeResponse(
      this.avayaChatConfig.initializers.connectionErrorText,
      this.avayaChatConfig.writeResponseClassSystem
    );
  }

  /**
   * Handle WebSocket message.
   *
   * @param event
   */
  handleMessage(event) {
    sendDebugMessage('Running AvayaChatSocket:handleMessage');
    const message = JSON.parse(event.data);
    const { body } = message;

    // Handle the message according to the type and method.
    // Notifications are in their own method to reduce complexity.
    if (message.type === this.avayaChatConfig.messageTypeNotification) {
      this.handleNotification(message);
    } else if (message.type === this.avayaChatConfig.messageTypeError) {
      // parse the error message
      this.parseErrorMessage(body);
    } else if (message.type === this.avayaChatConfig.messageTypeAck) {
      // Nothing to do for acks
    } else {
      throw new TypeError(`Unknown message type:\n${message}`);
    }
  }

  /**
   * Handle WebSocket opening.
   */
  handleOpen() {
    sendDebugMessage('Running AvayaChatSocket:handleOpen');
    this.avayaChatStore.manualClose = false;

    // set up the ping mechanism here.
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.avayaChatConfig.pingTimer);
    this.addToTimeouts(this.avayaChatConfig.pingInterval);

    this.chatLogin();

    // if there are agents in the chat, enable the controls
    if (Object.keys(this.avayaChatStore.users).length === 0) {
      // eslint-disable-next-line no-console
      console.debug('WebChat: No users in room, disabling controls');
      this.avayaChatUserInterface.disableControls(true);
    } else {
      // eslint-disable-next-line no-console
      console.debug('WebChat: Agents already in chat, enabling controls');
      this.avayaChatUserInterface.disableControls(false);
    }
  }

  /**
   * Open the WebSocket
   *
   * @param webChatUrl
   * @returns {boolean}
   */
  openSocket(webChatUrl) {
    sendDebugMessage('Running AvayaChatSocket:openSocket');
    // eslint-disable-next-line no-console
    console.info('WebChat: Opening the WebSocket');
    // Ensures only one connection is open at a time
    if (
      typeof this.avayaChatStore.webSocket !== 'undefined' &&
      this.avayaChatStore.webSocket !== null &&
      this.avayaChatStore.webSocket.readyState !== WebSocket.CLOSED
    ) {
      // eslint-disable-next-line no-console
      console.warn('WebChat: WebSocket is already opened');
      return false;
    }

    clearTimeout(this.avayaChatStore.reconnectionTimeout);

    // Create a new instance of the WebSocket using the specified url
    this.avayaChatStore.webSocket = new WebSocket(webChatUrl);
    // attach event handlers
    this.avayaChatStore.webSocket.onopen = () => {
      this.handleOpen();
    };
    this.avayaChatStore.webSocket.onmessage = (event) => {
      this.handleMessage(event);
    };
    this.avayaChatStore.webSocket.onerror = (event) => {
      this.handleError(event);
    };
    this.avayaChatStore.webSocket.onclose = (event) => {
      // eslint-disable-next-line no-console
      console.debug(`WebChat: Websocket closed with code ${event.code}`);

      // disable the controls upon close
      this.avayaChatUserInterface.disableControls(true);

      // If it is an expected/graceful close, do not attempt to reconnect.
      // Don't attempt reconnect if we haven't connected successfully
      // before
      if (
        !this.avayaChatStore.previouslyConnected ||
        this.avayaChatStore.dontRetryConnection ||
        event.code === 1000 ||
        event.code === 1005
      ) {
        clearLocalStorage();
        this.handleClose(event, webChatUrl);
      } else if (
        (event.code === 1006 || event.code === 1001) &&
        parseInt(getLocalStorage('lastChatRequestTimestamp'), 10) >
          this.avayaChatStore.lastChatRequestTimestamp
      ) {
        // chat was opened in another tab
        this.writeChatSessionTransferred();
      } else {
        this.reconnect();
      }
    };
    return true;
  }

  /**
   * Parse the error message.
   *
   * @param error
   */
  parseErrorMessage(error) {
    sendDebugMessage('Running AvayaChatSocket:parseErrorMessage');
    // eslint-disable-next-line no-console
    const { code } = error;
    const message = error.errorMessage;

    // eslint-disable-next-line no-console
    console.warn('WebChat: An error with status', code, 'occurred. Error message:', message);

    // HTTP 503 means "service unavailable" - which is a perfect description
    // for shutting down
    if (code === 503) {
      this.writeResponse(
        this.avayaChatConfig.initializers.closedForMaintenanceText,
        this.avayaChatConfig.writeResponseClassSystem
      );
    } else {
      const errorMsg = this.avayaChatConfig.initializers.errorOccurredText
        .replace('{0}', error.code)
        .replace('{1}', message);
      this.writeResponse(errorMsg, this.avayaChatConfig.writeResponseClassSystem);
    }

    // allow the user to clear the page if not error code 1
    // this stands for "invalid message"
    if (code !== 1) {
      this.avayaChatStore.dontRetryConnection = true;
      this.clearRefresh();
      if (
        typeof this.avayaChatStore.webSocket !== 'undefined' &&
        this.avayaChatStore.webSocket !== null
      ) {
        this.avayaChatStore.webSocket.close();
      }
    }
  }

  /**
   * Reconnect to the WebSocket.
   */
  reconnect() {
    sendDebugMessage('Running AvayaChatSocket:reconnect');
    if (this.avayaChatStore.dontRetryConnection) {
      // eslint-disable-next-line no-console
      console.warn("Attempting to reconnect when we shouldn't!");
      return;
    }

    if (this.avayaChatStore.webSocket.readyState !== WebSocket.OPEN) {
      this.avayaChatStore.customerDetails.isContinuingAfterRefresh = false;
      this.avayaChatStore.reconnectionTimeout = setTimeout(() => {
        if (this.avayaChatStore.totalNumberOfRetries <= this.avayaChatConfig.maxNumberOfRetries) {
          this.writeResponse(
            this.avayaChatConfig.initializers.attemptingToReconnectText,
            this.avayaChatConfig.writeResponseClassSystem
          );
          clearTimeout(this.avayaChatStore.reconnectionTimeout);
          this.avayaChatStore.totalNumberOfRetries += 1;
          this.openSocket(this.avayaChatStore.webChatUrl);
        } else {
          this.writeResponse(
            this.avayaChatConfig.initializers.unableToReconnectText,
            this.avayaChatConfig.writeResponseClassSystem
          );
        }
      }, this.avayaChatConfig.retryInterval);
    }
  }

  /**
   * Reset the number of connection attempts after a successful login.
   */
  resetConnectionAttempts() {
    sendDebugMessage('Running AvayaChatSocket:resetConnectionAttempts');
    this.avayaChatStore.totalNumberOfRetries = 0;
    clearTimeout(this.avayaChatStore.reconnectionTimeout);
  }

  /**
   * Reset the WebSocket.
   */
  resetWebSocket() {
    sendDebugMessage('Running AvayaChatSocket:resetWebSocket');
    this.avayaChatStore.initCalled = false;
    this.avayaChatStore.previouslyConnected = false;
    this.avayaChatStore.totalNumberOfRetries = 0;
    this.avayaChatStore.webSocket = null;
  }

  /**
   * Send a message over the WebSocket. May throw an InvalidStateError if
   * connection has failed; this can be ignored.
   *
   * @param {object} outMessage - A JSON object.
   */
  sendMessage(outMessage) {
    sendDebugMessage('Running AvayaChatSocket:sendMessage');
    const newMsg = {
      ...{
        authToken: this.authToken,
      },
      ...outMessage,
    };

    if (
      typeof this.avayaChatStore.webSocket !== 'undefined' &&
      this.avayaChatStore.webSocket !== null &&
      this.avayaChatStore.webSocket.readyState !== WebSocket.CLOSING &&
      this.avayaChatStore.webSocket.readyState !== WebSocket.CLOSED
    ) {
      this.avayaChatStore.webSocket.send(JSON.stringify(newMsg));
    }
  }

  /**
   * Sends the ping message.
   */
  sendPing() {
    sendDebugMessage('Running AvayaChatSocket:sendPing');
    const ping = {
      apiVersion: '1.0',
      type: 'request',
      body: {
        method: 'ping',
      },
    };
    this.sendMessage(ping);
  }
}

export default AvayaChatSocket;
