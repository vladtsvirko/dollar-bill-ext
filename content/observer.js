const ContentObserver = (() => {
  let debounceTimer = null;
  const pendingNodes = new Set();
  let observer = null;

  function start(onFlush) {
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && !Scanner.SKIP_TAGS.has(node.tagName)) {
            pendingNodes.add(node);
          }
        }
      }
      if (pendingNodes.size > 0) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => flush(onFlush), 300);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function flush(onFlush) {
    if (pendingNodes.size === 0) return;
    const nodes = [...pendingNodes];
    pendingNodes.clear();
    debounceTimer = null;
    onFlush(nodes);
  }

  function stop() {
    if (observer) observer.disconnect();
    clearTimeout(debounceTimer);
    pendingNodes.clear();
  }

  return { start, stop };
})();
