(async function Onboarding() {
  const settings = await Settings.getSettings();
  await I18n.init(settings.language);
  I18n.applyToPage();
  document.documentElement.setAttribute('data-theme', settings.theme || '');

  document.getElementById('ctaBtn').addEventListener('click', () => {
    chrome.action.openPopup();
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.remove(tab.id);
    });
  });

  document.getElementById('settingsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.getCurrent((tab) => {
      chrome.tabs.remove(tab.id);
      chrome.runtime.openOptionsPage();
    });
  });
})();
