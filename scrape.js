// ------------------------------ SCRAPER ------------------------------
// ---------------------------------------------------------------------

// ---------------------- HELPER FUNCTION ------------------------------

var waitingPageNavs = [];
chrome.webNavigation.onCompleted.addListener(function(details) {
  if (waitingPageNavs.length > 1) {
    throw new Error('multiple actions waiting on single page navigation');
  }
  if (waitingPageNavs.length === 0) return;
  if (waitingPageNavs[0].tabid !== details.tabId) return;

  let wpn = waitingPageNavs.pop();
  wpn.resolve(details.url);
});

function waitPageNav(tabid) {
  console.log('waiting for page navigation');
  return new Promise(resolve => {
    waitingPageNavs.push({
      tabid,
      resolve,
    });
  });
}

const waitingMessages = [];

async function waitMessage(tabid) {
  return new Promise(resolve => {
    if (waitingMessages.length > 0) throw new Error(
        'multiple actions waiting on single message');
    waitingMessages.push(resolve);
  });
}

chrome.runtime.onConnect.addListener((p) => {
  console.log('page connected');
  p.onMessage.addListener((d) => console.log('[debug]', d));
  p.onMessage.addListener(data => {
    if (waitingMessages.length > 0) {
      let r = waitingMessages.pop();
      r(data);
    }
  });
});

async function sendMessage(tabid, msg) {
  return new Promise(resolve => {
    let port = chrome.tabs.connect(tabid);
    port.postMessage(msg);
    console.log('sent message', msg);
    resolve();
  });
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
  console.log('tab id', sair.id);
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
  await checkCaptcha(tabid);
  await delay(5000);
  if (await checkLogin(tabid)) {
    return;
  }
  await chrome.tabs.reload(tabid);
  await delay(2500);
  console.log('logging in');
  await injectHelperScripts(tabid);
  await delay(2500);
  await sendMessage(tabid, {
    'action': 'login',
    'params': [id, pass],
  });

  await delay(7500);
  chrome.tabs.reload(tabid);
  await delay(5000);
  await checkCaptcha(tabid);
  await delay(2500);
  console.log('sending message loginRequestCheck');
  await delay(2500);
  await injectHelperScripts(tabid);
  await delay(2500);
  await sendMessage(tabid, {
    'action': 'loginRequestCheck',
  });
  let res = await waitMessage(tabid);
  if (res.data === 'captcha') {
    throw new Error('captcha encountered');
  }
}

async function search(
    tabid, origin, destination, departure, arrival, cabin, passengers) {
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

  await checkCaptcha(tabid);
  console.log('executed search script');
  chrome.tabs.executeScript(tabid, {code: searchScript});
  await waitPageNav(tabid);
  await checkCaptcha(tabid);
  await delay(15000);

  await sendMessage(tabid, {
    'action': 'searchRequestCheck',
  });

  console.log('sending message searchRequestCheck');
  await injectHelperScripts(tabid);
  await delay(2500);
  await sendMessage(tabid, {
    'action': 'searchResultsCheck',
  });
  let searchRes = await waitMessage(tabid);
  if (searchRes.data === 'seats available') {
    return true;
  }
  return false;
}

async function checkCaptcha(tabid) {
  console.log('checking captcha');
  while ((await chrome.tabs.get(tabid)).state === 'loading') {
    console.log('waiting...');
    await delay(500);
  }
  injectHelperScripts(tabid);
  await delay(2500);
  await sendMessage(tabid, {
    'action': 'captchaCheck',
  });
  let logRes = await waitMessage(tabid);
  if (logRes.data === 'captcha') {
    console.log('captcha detected');
  } else {
    console.log('no captcha detected');
    await chrome.tabs.reload(tabid);
  }
  while (logRes.data === 'captcha') {
    chrome.notifications.create('sqstart', {
      type: 'basic',
      iconUrl: 'images/get_started128.png',
      title: 'SQ-Scraper',
      message: 'captcha solve required',
    });
    await waitPageNav(tabid);
    await delay(1500);
    await injectHelperScripts(tabid);
    await sendMessage(tabid, {
      'action': 'captchaCheck',
    });
    let logRes = await waitMessage(tabid);
  }
}

async function checkLogin(tabid) {
  console.log('checking login');
  await injectHelperScripts(tabid);
  await delay(2000);
  await sendMessage(tabid, {
    'action': 'loginCheck',
  });
  let loginRes = await waitMessage(tabid);
  await chrome.tabs.reload(tabid);

  if (loginRes.data === 'loggedin') {
    console.log('logged in');
    return true;
  }
  console.log('not logged in');
  return false;
}

async function injectHelperScripts(id) {
  await chrome.tabs.executeScript(id, {file: 'scripts/jquery-3.4.1.js'});
  await chrome.tabs.executeScript(id, {file: 'scripts/moment-with-locales.js'});
  await chrome.tabs.executeScript(id, {file: 'injections/helpers.js'});
  await chrome.tabs.executeScript(id, {file: 'injections/sq.js'});
  await chrome.tabs.executeScript(id,
      {code: 'console.log("injected helper scripts");'});
}