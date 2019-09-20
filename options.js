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
    await injectHelperScripts(id);
    await delay(1000);
    await search(id, 'SFO', 'SIN', moment('20191002', 'YYYYMMDD'),
        moment('20191010', 'YYYYMMDD'), 'business', '1');
  }

  const btn = $('#runsearch');
  btn.click(async (e) => {
    console.log('running search');
    runSearch();
  });
}

// ------------------------------ SCRAPER ------------------------------
// ---------------------------------------------------------------------



// ---------------------- HELPER FUNCTION ------------------------------

var waitingPageNavs = [];
chrome.webNavigation.onCompleted.addListener(function (details) {
  if (waitingPageNavs.length > 1) {
    throw new Error("multiple actions waiting on single page navigation");
  }
  if (waitingPageNavs.length === 0) return;
  if (waitingPageNavs[0].tabid !== details.tabId) return;

  let wpn = waitingPageNavs.pop();
  wpn.resolve(details.url);
});

function waitPageNav(tabid) {
  console.log("waiting for page navigation");
  return new Promise(resolve => {
    waitingPageNavs.push({
      tabid,
      resolve
    })
  });
}

function waitMessage(tabid) {
  let listener;
  return new Promise(resolve => {
    listener = function (request, sender, sendResponse) {
      chrome.runtime.onMessage.removeListener(listener);
      resolve(request);
    };

    chrome.runtime.onMessage.addListener(listener);
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------- SCRAPE METHODS -------------------------------
async function initWindow() {
  const window = await chrome.windows.create({
    url: 'https://www.singaporeair.com/en_UK/us/home',
    state: 'maximized',
  });
  const sair = window.tabs[0];
  await waitPageNav(sair.id);
  return sair.id;
}

async function runScrape() {
  console.log('running scrape');
  const {memberid, memberpass} = await
      chrome.storage.sync.get(['memberid', 'memberpass']);

  const tabid = await initWindow();
  await login(tabid, memberid, memberpass);
}

async function login(tabid, id, pass) {
  console.log("logging in");
  await injectHelperScripts(tabid);
  await chrome.tabs.executeScript(tabid, {file: 'injections/sq.js'});
  await delay(2500);
  await chrome.tabs.sendMessage(tabid, {
    'action': 'login',
    'params': [id, pass],
  });

  console.log('waiting for login finish');
  let urlChanges = 0;
  while (urlChanges < 2 || (await chrome.tabs.get(tabid)).url !== 'https://www.singaporeair.com/en_UK/us/home#/book/bookflight') {
    console.log((await chrome.tabs.get(tabid)).url);
    urlChanges++;
    await waitPageNav(tabid);
  }
  console.log('login finished');
  await delay(5000);
  console.log('sending message loginRequestCheck');
  await injectHelperScripts(tabid);
  await chrome.tabs.executeScript(tabid, {file: 'injections/sq.js'});
  await delay(2500);
  await chrome.tabs.sendMessage(tabid, {
    'action': 'loginRequestCheck',
  });
  console.log(await waitMessage(tabid));
}

async function search(tabid, origin, destination, departure, arrival, cabin, passengers) {
  if ('economy' == cabin) {
    cabin = 'Y';
  } else {
    if ('business' == cabin) {
      cabin = 'J';
    } else {
      if (!(-1 === cabin.indexOf('first') && 1 === cabin.indexOf('suite'))) {
        cabin = 'F';
      }
    }
  }

  let searchScript = `
        console.log('injected search script');
        function addInput(name, value, form) {
          var input = document.createElement("input");
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }

        var sqForm = document.getElementsByClassName("book-trip-form")[0];
        var f = sqForm.cloneNode(true);
        var aForm = f.getElementsByTagName("input");
        while (aForm[0]) {
            aForm[0].remove();
        }
        addInput("_payByMiles","on", f);
        addInput("payByMiles" ,"true", f);
        addInput("fromHomePage" ,"true", f);
        addInput("orbOrigin" ,"${origin.toUpperCase()}", f);
        addInput("orbDestination" ,"${destination.toUpperCase()}", f);
        addInput("_tripType" ,"on", f);
        addInput("tripType" ,"O", f);
        addInput("departureMonth" ,"${moment(departure).format('DD/MM/YYYY')}", f);
        addInput("returnMonth" ,"${moment(arrival).format('DD/MM/YYYY')}", f);
        addInput("cabinClass" ,"${cabin}", f);
        addInput("numOfAdults" ,"${passengers}", f);
        addInput("numOfChildren" ,"0", f);
        addInput("numOfInfants" ,"0", f);
        addInput("flowIdentifier" ,"redemptionBooking", f);
        addInput("_eventId_flightSearchEvent" ,"", f);
        addInput("isLoggedInUser" ,"true", f);
        addInput("numOfChildrenNominees" ,"1", f);
        addInput("numOfAdultNominees" ,"1", f);
        addInput("flexibleDates" ,"off", f);
        document.body.appendChild(f);
        f.submit();
        `;

  chrome.tabs.executeScript(tabid, {code: searchScript});
  await waitPageNav(tabid);
  await delay(2500);

}

async function injectHelperScripts(id) {
  await chrome.tabs.executeScript(id, {file: 'scripts/jquery-3.4.1.js'});
  await chrome.tabs.executeScript(id, {file: 'scripts/moment-with-locales.js'});
  await chrome.tabs.executeScript(id, {file: 'injections/helpers.js'});
  await chrome.tabs.executeScript(id,
      {code: 'console.log("injected helper scripts");'});
}

function main() {
  showAccount();
  attachFormHandler();
  attachScrapeRunner();
  attachSearchRunner();
}

$(document).ready(function() {
  main();
});
