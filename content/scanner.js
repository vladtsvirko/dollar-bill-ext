const Scanner = (() => {
  const INJECTED_ATTR = 'data-dollarbill';
  const INJECTED_CLASS = 'dollarbill-converted';
  const PILL_CLASS = 'db-pill';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'SVG', 'MATH']);

  function acceptTextNode(n) {
    if (!n.parentElement || SKIP_TAGS.has(n.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
    if (n.parentElement.hasAttribute(INJECTED_ATTR)) return NodeFilter.FILTER_REJECT;
    if (n.parentElement.classList.contains(INJECTED_CLASS)) return NodeFilter.FILTER_REJECT;
    if (n.parentElement.classList.contains(PILL_CLASS)) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }

  function scanNode(node, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous) {
    if (!node) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: acceptTextNode });

    const textNodes = [];
    let current;
    while ((current = walker.nextNode())) {
      textNodes.push(current);
    }
    for (const tn of textNodes) {
      ContentConverter.processTextNode(tn, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous);
    }
  }

  function hasAmbiguousMatches(node, compiledAmbiguous) {
    if (!node) return false;
    let found = false;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: acceptTextNode });
    let current;
    while ((current = walker.nextNode()) && !found) {
      const text = current.nodeValue;
      for (const pattern of compiledAmbiguous) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(text)) {
          found = true;
          break;
        }
      }
    }
    return found;
  }

  return { acceptTextNode, scanNode, hasAmbiguousMatches, SKIP_TAGS };
})();
