$(document).ready(function() {
  attachMessageHandler();
});

function attachMessageHandler() {
  chrome.runtime.onConnect.addListener((inPort) => {
    console.log('extension connected');
    // port.postMessage("page connected");
    let outPort = chrome.runtime.connect();
    inPort.postMessage('extension connected');
    inPort.onMessage.addListener(function(request) {
      console.log('message received', request);
      if (request.action === 'login') {
        console.log('received login request');
        login(...request.params);
      } else if (request.action === 'captchaCheck') {
        console.log('received captcha check request');
        outPort.postMessage(captchaCheck());
      } else if (request.action === 'loginCheck') {
        console.log('received login check request');
        outPort.postMessage(loginCheck());
      } else if (request.action === 'loginResultsCheck') {
        console.log('received login result check request');
        outPort.postMessage(loginResultsCheck());
      } else if (request.action === 'searchRequestCheck') {
        console.log('received search request check request');
        outPort.postMessage(searchRequestCheck());
      } else if (request.action === 'searchResultsCheck') {
        console.log('received search results check request');
        outPort.postMessage(searchResultsCheck());
      }
      return true;
    });
  });
}

function login(id, pass) {
  console.log('logging in', id, pass);
  chain([
    {
      fn: () => {
        $('button.button-kf-login').click();
      },
      delay: 5000,
    },
    {
      fn: () => {
        $('div.form_control.field__radiobox.field__radiobox--position>input#kfPpsClubs').
            click();
      },
      delay: 500,
    },
    {
      fn: () => {
        document.getElementById('userEmailKfPpsClub').select();
        document.execCommand('insertText', false, id);
      },
      delay: 1000,
    }, {
      fn: () => {
        document.getElementById('userPasswordKfPpsClub').select();
        document.execCommand('insertText', false, pass);
      },
      delay: 1000,
    }, {
      fn: () => {
        $('div.login-btn-wrapper>button')[1].click();
      },
      delay: 1000,
    },
  ]);
}

function loginResultsCheck() {
  if (-1 < document.title.toLowerCase().indexOf('captcha') || -1 !==
      $('body').text().toLowerCase().indexOf('access blocked')) {
    return {
      action: 'loginResultsCheck',
      data: 'captcha',
    };
  }
}

function captchaCheck() {
  if (-1 < document.title.toLowerCase().indexOf('captcha') || -1 !==
      $('body').text().toLowerCase().indexOf('access blocked')) {
    return {
      action: 'captchaCheck',
      data: 'captcha',
    };
  }
  return {
    action: 'captchaCheck',
    data: 'nocaptcha',
  };
}

function loginCheck() {
  if ($('span.lang-profile_login')[0] == undefined) {
    return {
      action: 'loginCheck',
      data: 'loggedin',
    };
  }
  return {
    action: 'loginCheck',
    data: 'notloggedin',
  };
}

function searchRequestCheck() {
  if (-1 < document.title.toLowerCase().indexOf('captcha') || -1 !==
      $('body').text().toLowerCase().indexOf('access blocked')) {
    return {
      action: 'loginResultsCheck',
      data: 'captcha',
    };
  }
}

function searchResultsCheck() {
  console.log('checking search results');
  if ($('div.booking_form_error').length > 0) {
    return {
      action: 'searchResultsCheck',
      data: 'no seats',
    };
  } else if ($('body').text().indexOf('Select alternative date(s)') >= 0) {
    return {
      action: 'searchResultsCheck',
      data: 'no seats',
    };
  } else {
    return {
      action: 'searchResultsCheck',
      data: 'seats available',
    };
  }
}