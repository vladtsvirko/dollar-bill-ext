const Scanner = (() => {
  const INJECTED_ATTR = 'data-dollarbill';
  const INJECTED_CLASS = 'dollarbill-converted';
  const PILL_CLASS = 'db-pill';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'SVG', 'MATH']);

  const INLINE_TAGS = new Set([
    'SPAN', 'A', 'B', 'I', 'STRONG', 'EM', 'SMALL', 'MARK', 'SUB', 'SUP',
    'ABBR', 'TIME', 'LABEL', 'FONT', 'S', 'U', 'BIG', 'CITE', 'DFN', 'KBD',
    'Q', 'SAMP', 'VAR'
  ]);

  function acceptTextNode(n) {
    if (!n.parentElement || SKIP_TAGS.has(n.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
    if (n.parentElement.hasAttribute(INJECTED_ATTR)) return NodeFilter.FILTER_REJECT;
    if (n.parentElement.classList.contains(INJECTED_CLASS)) return NodeFilter.FILTER_REJECT;
    if (n.parentElement.classList.contains(PILL_CLASS)) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }

  // Walk up through inline parents, return the topmost inline element
  // (or the text node itself if parent is block-level)
  function findInlineBoundary(textNode) {
    let node = textNode;
    while (node.parentElement && INLINE_TAGS.has(node.parentElement.tagName)) {
      node = node.parentElement;
    }
    return node;
  }

  // Find the nearest block-level ancestor (skipping inline wrappers)
  function findBlockParent(textNode) {
    let el = textNode.parentElement;
    while (el && INLINE_TAGS.has(el.tagName)) {
      el = el.parentElement;
    }
    return el;
  }

  // Test whether a combined text would match any compiled pattern
  function wouldMatchCombined(combined, compiledUnambiguous, compiledAmbiguous) {
    for (let pi = 0; pi < compiledUnambiguous.length; pi++) {
      const pattern = compiledUnambiguous[pi];
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(combined)) {
        pattern.regex.lastIndex = 0;
        return true;
      }
    }
    for (let pi = 0; pi < compiledAmbiguous.length; pi++) {
      const pattern = compiledAmbiguous[pi];
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(combined)) {
        pattern.regex.lastIndex = 0;
        return true;
      }
    }
    return false;
  }

  // Try merging a text node with up to `maxExtra` following text nodes in the same block.
  // Returns the index of the last merged node, or -1 if no match found.
  function tryMultiNodeMerge(textNodes, startIdx, blockParent, compiledUnambiguous, compiledAmbiguous, maxExtra) {
    const tn = textNodes[startIdx];
    let combined = tn.nodeValue || '';
    const baseBlock = blockParent;

    for (let j = 1; j <= maxExtra && startIdx + j < textNodes.length; j++) {
      const next = textNodes[startIdx + j];
      if (!next.parentElement) break;
      const nextBlock = findBlockParent(next);
      if (nextBlock !== baseBlock) break;

      combined += next.nodeValue || '';
      if (wouldMatchCombined(combined, compiledUnambiguous, compiledAmbiguous)) {
        return startIdx + j;
      }
    }
    return -1;
  }

  function scanNode(node, ratesData, conversionMap, ambiguousCurrency, currentSettings, compiledUnambiguous, compiledAmbiguous) {
    if (!node) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: acceptTextNode });

    const textNodes = [];
    let current;
    while ((current = walker.nextNode())) {
      textNodes.push(current);
    }

    const skip = new Set();
    for (let i = 0; i < textNodes.length; i++) {
      if (skip.has(i)) continue;

      const tn = textNodes[i];
      if (!tn.parentElement) continue;

      const matched = ContentConverter.processTextNode(
        tn, ratesData, conversionMap, ambiguousCurrency,
        currentSettings, compiledUnambiguous, compiledAmbiguous
      );

      if (!matched) {
        const blockParent = findBlockParent(tn);
        const lastIdx = tryMultiNodeMerge(textNodes, i, blockParent, compiledUnambiguous, compiledAmbiguous, 4);

        if (lastIdx > i) {
          // Merge all nodes from i to lastIdx into tn
          const parts = [];
          for (let j = i; j <= lastIdx; j++) {
            parts.push(textNodes[j].nodeValue || '');
          }
          tn.nodeValue = parts.join('');

          // Remove the DOM boundaries of merged nodes (i+1 through lastIdx)
          for (let j = i + 1; j <= lastIdx; j++) {
            const mergedNode = textNodes[j];
            if (mergedNode.parentElement) {
              const boundary = findInlineBoundary(mergedNode);
              boundary.remove();
            }
            skip.add(j);
          }

          console.log('[DB split]', JSON.stringify(parts[0]), '+', JSON.stringify(parts.slice(1).join('')), '→ merge');

          // Re-process the now-combined node
          ContentConverter.processTextNode(
            tn, ratesData, conversionMap, ambiguousCurrency,
            currentSettings, compiledUnambiguous, compiledAmbiguous
          );
        }
      }
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
