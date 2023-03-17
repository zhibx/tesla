class AnalyticsHelper {
  constructor(isTriage, isAnalyticsOn) {
    this.isTriage = isTriage;
    this.isAnalyticsOn = isAnalyticsOn;

    this.impressionInteraction = 'impression';
    this.formInitiatedInteraction = 'form-initiated';
    this.chooseTopicInteraction = 'choose-topic';
    this.secondaryTopicInteraction = '';
    this.formShownInteraction = 'form-shown';
    this.supportInteraction = 'support';
    this.needAssistanceInteraction = 'i-still-need-assistance';
    this.goToAccountInteraction = 'go-to-account';
    this.startedInteraction = 'started';
    this.backInteraction = 'back';
    this.exitInteraction = 'exit';
    this.navigateInteraction = 'navigate';

    this.chatPrefix = 'chat-';
    this.triagePrefix = 'triage-chat-';
  }

  fireEvent(interaction, dynamic) {
    if (window.dataLayer && this.isAnalyticsOn) {
      const tag = this.getGATag(interaction, dynamic);
      window.dataLayer.push(tag);
    }
  }

  // For tracking redirects
  fireEventWithCallback(interaction, dynamic, eventCallback) {
    if (window.dataLayer && this.isAnalyticsOn) {
      const tag = this.getGATag(interaction, dynamic);
      tag.eventCallback = eventCallback;
      window.dataLayer.push(tag);
    }
  }

  getGATag(interaction, dynamic = '') {
    if (dynamic !== '') {
      // eslint-disable-next-line no-param-reassign
      interaction =
        interaction !== this.secondaryTopicInteraction ? `${interaction}-${dynamic}` : dynamic;
    }

    const interactionWithPrefix = this.isTriage
      ? this.triagePrefix + interaction
      : this.chatPrefix + interaction;

    return {
      event: 'chat',
      interaction: interactionWithPrefix,
    };
  }
}

export default AnalyticsHelper;
