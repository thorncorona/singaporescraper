'use strict';

chrome.alarms.onAlarm.addListener(function(alarm) {
  chrome.notifications.create('sqstart-' + Date.now(), {
    type: 'basic',
    iconUrl: 'images/get_started128.png',
    title: 'SQ-Scraper',
    message: 'Scraping started',
  });
  runScrape();
});
