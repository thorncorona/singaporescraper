'use strict';

async function showAccount() {
  const {memberid, memberpass} = await
      chrome.storage.sync.get(['memberid', 'memberpass']);
  $('#memberid').attr('value', memberid);
  $('#memberpass').attr('value', memberpass);
}

function attachFormHandler() {
  const form = $('#memberform');
  form.submit(async (e) => {
    e.preventDefault();
    const data = form.serializeArray().reduce(function(obj, item) {
      obj[item.name] = item.value;
      return obj;
    }, {});

    const {memberid, memberpass} = data;
    await chrome.storage.sync.set({memberid, memberpass});
  });
}

let scrapeRunning = false;

function attachScrapeRunner() {
  const btn = $('#runscrape');
  btn.click(async (e) => {
    if (scrapeRunning) return;
    runScrape();
  });
}

async function attachSearchRunner() {
  async function runSearch() {
    const id = await initWindow();
    await waitPageNav(id);
    await injectHelperScripts(id);
    await delay(1000);
    await search(id, 'SFO', 'SIN', moment('20191002', 'YYYYMMDD'),
        moment('20191010', 'YYYYMMDD'), 'business', '4');
  }

  const btn = $('#runsearch');
  btn.click(async (e) => {
    console.log('running search');
    runSearch();
  });
}

function attachAlarmScheduler() {
  async function scheduleAlarm(n) {
    await chrome.alarms.clearAll();
    chrome.alarms.create('sq-scrape', {periodInMinutes: n});
  }

  const btn = $('#scheduleAlarm');
  btn.click(e => {
    console.log('scheduling alarm');
    scheduleAlarm(Number($('#alarmperiod').val()));
  });
}


function main() {
  showAccount();
  attachFormHandler();
  attachScrapeRunner();
  attachSearchRunner();
  attachAlarmScheduler();
}

$(document).ready(function() {
  main();
});
