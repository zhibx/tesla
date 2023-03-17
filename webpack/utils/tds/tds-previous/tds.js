/*!
 * tabbable 5.2.0
 * @license MIT, https://github.com/focus-trap/tabbable/blob/master/LICENSE
 */
var candidateSelectors = [
  'input',
  'select',
  'textarea',
  'a[href]',
  'button',
  '[tabindex]',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  'details>summary:first-of-type',
  'details',
];
var candidateSelector = /* #__PURE__ */ candidateSelectors.join(',');
var matches =
  typeof Element === 'undefined'
    ? function () {}
    : Element.prototype.matches ||
      Element.prototype.msMatchesSelector ||
      Element.prototype.webkitMatchesSelector;

var sortOrderedTabbables = function sortOrderedTabbables(a, b) {
  return a.tabIndex === b.tabIndex ? a.documentOrder - b.documentOrder : a.tabIndex - b.tabIndex;
};

// modified functions form @tesla/design-system
// all classes prefixed with tw-chat-- to avoid conflicts with page's tds
var isContentEditable = function isContentEditable(node) {
  return node.contentEditable === 'true';
};

var getTabindex = function getTabindex(node) {
  var tabindexAttr = parseInt(node.getAttribute('tabindex'), 10);

  if (!isNaN(tabindexAttr)) {
    return tabindexAttr;
  } // Browsers do not return `tabIndex` correctly for contentEditable nodes;
  // so if they don't have a tabindex attribute specifically set, assume it's 0.

  if (isContentEditable(node)) {
    return 0;
  } // in Chrome, <details/>, <audio controls/> and <video controls/> elements get a default
  //  `tabIndex` of -1 when the 'tabindex' attribute isn't specified in the DOM,
  //  yet they are still part of the regular tab order; in FF, they get a default
  //  `tabIndex` of 0; since Chrome still puts those elements in the regular tab
  //  order, consider their tab index to be 0.

  if (
    (node.nodeName === 'AUDIO' || node.nodeName === 'VIDEO' || node.nodeName === 'DETAILS') &&
    node.getAttribute('tabindex') === null
  ) {
    return 0;
  }

  return node.tabIndex;
};

var isDetailsWithSummary = function isDetailsWithSummary(node) {
  var r =
    node.tagName === 'DETAILS' &&
    Array.prototype.slice.apply(node.children).some(function (child) {
      return child.tagName === 'SUMMARY';
    });
  return r;
};

var isRadio = function isRadio(node) {
  return isInput(node) && node.type === 'radio';
};

var getCheckedRadio = function getCheckedRadio(nodes, form) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].checked && nodes[i].form === form) {
      return nodes[i];
    }
  }
};

var isTabbableRadio = function isTabbableRadio(node) {
  if (!node.name) {
    return true;
  }

  var radioScope = node.form || node.ownerDocument;

  var queryRadios = function queryRadios(name) {
    return radioScope.querySelectorAll('input[type="radio"][name="' + name + '"]');
  };

  var radioSet;

  if (
    typeof window !== 'undefined' &&
    typeof window.CSS !== 'undefined' &&
    typeof window.CSS.escape === 'function'
  ) {
    radioSet = queryRadios(window.CSS.escape(node.name));
  } else {
    try {
      radioSet = queryRadios(node.name);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        'Looks like you have a radio button with a name attribute containing invalid CSS selector characters and need the CSS.escape polyfill: %s',
        err.message
      );
      return false;
    }
  }

  var checked = getCheckedRadio(radioSet, node.form);
  return !checked || checked === node;
};

var isNonTabbableRadio = function isNonTabbableRadio(node) {
  return isRadio(node) && !isTabbableRadio(node);
};

var isHidden = function isHidden(node, displayCheck) {
  if (window.getComputedStyle(node).visibility === 'hidden') {
    return true;
  }

  var isDirectSummary = matches.call(node, 'details>summary:first-of-type');
  var nodeUnderDetails = isDirectSummary ? node.parentElement : node;

  if (matches.call(nodeUnderDetails, 'details:not([open]) *')) {
    return true;
  }

  if (!displayCheck || displayCheck === 'full') {
    while (node) {
      if (window.getComputedStyle(node).display === 'none') {
        return true;
      }

      node = node.parentElement;
    }
  } else if (displayCheck === 'non-zero-area') {
    var _node$getBoundingClie = node.getBoundingClientRect(),
      width = _node$getBoundingClie.width,
      height = _node$getBoundingClie.height;

    return width === 0 && height === 0;
  }

  return false;
};

var isInput = function isInput(node) {
  return node.tagName === 'INPUT';
};

var isHiddenInput = function isHiddenInput(node) {
  return isInput(node) && node.type === 'hidden';
};

var isNodeMatchingSelectorFocusable = function isNodeMatchingSelectorFocusable(options, node) {
  if (
    node.disabled ||
    isHiddenInput(node) ||
    isHidden(node, options.displayCheck) ||
    /* For a details element with a summary, the summary element gets the focused  */
    isDetailsWithSummary(node)
  ) {
    return false;
  }

  return true;
};

var isNodeMatchingSelectorTabbable = function isNodeMatchingSelectorTabbable(options, node) {
  if (
    !isNodeMatchingSelectorFocusable(options, node) ||
    isNonTabbableRadio(node) ||
    getTabindex(node) < 0
  ) {
    return false;
  }

  return true;
};

var getCandidates = function getCandidates(el, includeContainer, filter) {
  var candidates = Array.prototype.slice.apply(el.querySelectorAll(candidateSelector));

  if (includeContainer && matches.call(el, candidateSelector)) {
    candidates.unshift(el);
  }

  candidates = candidates.filter(filter);
  return candidates;
};

var tabbable = function tabbable(el, options) {
  options = options || {};
  var regularTabbables = [];
  var orderedTabbables = [];
  var candidates = getCandidates(
    el,
    options.includeContainer,
    isNodeMatchingSelectorTabbable.bind(null, options)
  );
  candidates.forEach(function (candidate, i) {
    var candidateTabindex = getTabindex(candidate);

    if (candidateTabindex === 0) {
      regularTabbables.push(candidate);
    } else {
      orderedTabbables.push({
        documentOrder: i,
        tabIndex: candidateTabindex,
        node: candidate,
      });
    }
  });
  var tabbableNodes = orderedTabbables
    .sort(sortOrderedTabbables)
    .map(function (a) {
      return a.node;
    })
    .concat(regularTabbables);
  return tabbableNodes;
};

/**
 * trapFocus
 * - If a user tabs off the end, set the focus to the first element againn
 * - If a user shift+tabbs off the beginning, set the focus to the last element
 * - NOTE: The doublefunction allows us to pass additional data into the event handler
 */
const trapFocus = (parent) => (e) => {
  if (e.key === 'Tab' && !parent.contains(e.target)) {
    const tabbableElements = tabbable(parent) || [];

    if (tabbableElements.length) {
      if (e.shiftKey) {
        tabbableElements[tabbableElements.length - 1].focus();
      } else {
        tabbableElements[0].focus();
      }
    }
  }
};

/**
 * trapFocusIfRepeat
 * - If a user is holding down the tab key, also trap focus
 * - This way a user wouldn't be able to cheat their way off the focus-trapped element by never lifting their finger
 */
const trapFocusIfRepeat = (parent) => (e) => {
  if (e.key === 'Tab' && e.repeat) {
    trapFocus(parent)(e);
  }
};

/**
 * startTrappingFocus
 * - sets up a focus trap on the given parent
 * @param parent - The parent element to trap the focus within
 */
const startTrappingFocus = (parent) => {
  document.addEventListener('keyup', trapFocus(parent));
  document.addEventListener('keydown', trapFocusIfRepeat(parent));
};

/**
 * stopTrappingFocus
 * - removes the focus trap from the given element
 * @param parent - The parent element to trap the focus within
 */
const stopTrappingFocus = (parent) => {
  document.removeEventListener('keyup', trapFocus(parent));
  document.removeEventListener('keydown', trapFocusIfRepeat(parent));
};

const closeModal = (modal) => {
  modal.removeAttribute('open');
  modal.removeAttribute('aria-hidden', 'true');

  stopTrappingFocus(modal);
  document.body.classList.remove('tw-chat--tds-modal--is-open');
  modal.classList.remove('tw-chat--tds-modal--scrolling');
};

/**
 * openModal
 * @param modal {HTML Node} - the modal to open
 */
const openModal = (modal) => {
  modal.setAttribute('open', '');
  modal.setAttribute('aria-hidden', 'false');

  // If the body is blocked from interaction, block it from scrolling as well

  if (
    modal.nextElementSibling &&
    modal.nextElementSibling.classList.contains('tw-chat--tds-modal-backdrop')
  ) {
    document.body.classList.add('tw-chat--tds-modal--is-open');
  }

  startTrappingFocus(modal);
  // eslint-disable-next-line default-case
  window.addEventListener('keyup', (e) => {
    switch (e.key) {
      case 'Esc':
      case 'Escape':
        closeModal(modal);
        break;
      default:
        break;
    }
  });

  const content = modal.querySelector('.tw-chat--tds-modal-content');

  if (content) {
    content.scrollTop = 0;

    content.addEventListener('scroll', () => {
      if (modal.getAttribute('open') !== undefined && content.scrollTop > 0) {
        modal.classList.add('tw-chat--tds-modal--scrolling');
      } else {
        modal.classList.remove('tw-chat--tds-modal--scrolling');
      }
    });
  }
};

/**
 * initializeModals (v4 only)
 * @deprecated This function will be replaced by init(parent, props) in TDS v5
 * - loop over each modal and init event listeners
 * @param onCloseStart {function} - callback to be fired when the modal starts to close
 * @param onCloseFinish {function} - callback to be fired when the modal finishes it's close animation
 */
const initializeModals = ({ onCloseFinish, onCloseStart }) => {
  const openers = [...document.querySelectorAll('[data-tds-open-modal]')];
  const closers = [...document.querySelectorAll('[data-tds-close-modal]')];

  openers.forEach((opener) => {
    const targetModal = document.getElementById(opener.getAttribute('data-tds-open-modal'));

    opener.addEventListener('click', () => openModal(targetModal));
  });

  closers.forEach((closer) => {
    const targetModal = document.getElementById(closer.getAttribute('data-tds-close-modal'));

    closer.addEventListener('click', () => {
      closeModal(targetModal);
      if (onCloseStart) onCloseStart();
      if (onCloseFinish) {
        setTimeout(onCloseFinish, 500);
      }
    });
  });
};

export { initializeModals, openModal, closeModal };
