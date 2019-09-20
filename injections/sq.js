$(document).ready(function() {
  attachMessageHandler();
});

function attachMessageHandler() {
  chrome.runtime.onMessage.addListener(handleMessage);
}

function handleMessage(request, sender, sendResponse) {
  if (request.action === 'login') {
    console.log('received login request');
    sendResponse({
      action: 'message',
      message: 'loginActionReceived',
    });
    login(...request.params);
  } else if (request.action === 'loginResultsCheck') {
    console.log('received login result check request');
    sendResponse({
      action: 'message',
      message: 'loginResultsCheckReceived',
    });
    loginResultsCheck(sendResponse);
  }
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

function loginResultsCheck(sendResponse) {
  if (-1 < document.title.toLowerCase().indexOf('captcha') || -1 !==
      $('body').text().toLowerCase().indexOf('access blocked')) {
    sendResponse({
      action: 'identification',
      data: 'captcha',
    });
  }
}

function searchResultsCheck(sendResponse) {
  if ($('div.booking_form_error').length > 0) {
    sendResponse({
      action: 'searchResultsCheck',
      data: 'no seats',
    });
  } else if ($("body").text().contains('Select alternative date(s)')) {
    sendResponse({
      action: 'searchResultsCheck',
      data: 'no seats',
    });
  }
}