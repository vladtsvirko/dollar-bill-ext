(async function Onboarding() {
  const settings = await Settings.getSettings();
  await I18n.init(settings.language);
  I18n.applyToPage();
  document.documentElement.setAttribute('data-theme', settings.theme || '');

  document.getElementById('ctaBtn').addEventListener('click', () => {
    chrome.action.openPopup().catch(() => {
      chrome.windows.create({
        url: chrome.runtime.getURL('popup/popup.html'),
        type: 'popup',
        width: 380,
        height: 520
      });
    });
  });

  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.remove(tab.id);
    });
  });
})();
