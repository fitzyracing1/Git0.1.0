'use strict';

// Respond to background requests for page context
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'get-context') {
    sendResponse({
      url:             window.location.href,
      title:           document.title,
      selectedText:    window.getSelection().toString().substring(0, 300),
      metaDescription: document.querySelector('meta[name="description"]')?.content || '',
      h1:              document.querySelector('h1')?.textContent?.trim() || '',
      linkCount:       document.querySelectorAll('a').length,
      imageCount:      document.querySelectorAll('img').length,
    });
  }
  return true;
});
