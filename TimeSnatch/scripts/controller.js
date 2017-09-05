chrome.runtime.onInstalled.addListener(function (object) {
    if(object.reason === 'install'){
      chrome.runtime.openOptionsPage();
    }
});

chrome.browserAction.setBadgeBackgroundColor({ color: "#e74c3c"});

var currentDate;
chrome.storage.sync.get('date', function(data){
  currentDate = getDateFormat(new Date());

  if(data.date && currentDate != data.date){
      resetDayTimes();
  }

  chrome.storage.sync.set({'date': currentDate});
});

blockInterval = null;
block = null;


chrome.tabs.onCreated.addListener(function(tab) {
  if(tab.active && tab.url){
    eventStart();
    checkBlocked(tab);
  }
});

chrome.tabs.onUpdated.addListener(function(tabId, changedInfo, tab) {
  if(tab.active && tab.url){
    eventStart();
    checkBlocked(tab);
  }
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
  eventStart();
  chrome.tabs.get(activeInfo.tabId, function(tab){
    checkBlocked(tab);
  });
});

chrome.windows.onFocusChanged.addListener(function(windowId){
  if(windowId != chrome.windows.WINDOW_ID_NONE){
    eventStart();
    chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
      checkBlocked(tabs[0]);
    });
  }
});

function checkBlocked(tab){
  chrome.storage.sync.get('blockList', function(data){
      if(data.blockList && data.blockList.length){
        var blockList = data.blockList;
        for(i in blockList){
          var currentBlock = blockList[i];
          if(getDomain(tab.url) == currentBlock.url){

            setBadge(getMinutesAndSeconds(currentBlock.timeDay, currentBlock.timeTotal));

            if(currentBlock.timeDay >= currentBlock.timeTotal){
              setBadge('');
              redirectTo(currentBlock.redirectUrl, tab.id);
            }else{
              block = {
                "tabId": tab.id,
                "listId": i,
                "url": currentBlock.url,
                "timeDay": currentBlock.timeDay,
                "timeTotal": currentBlock.timeTotal,
                "redirectUrl": currentBlock.redirectUrl,
                "blockList": blockList
              }

              if(blockInterval == null){
                startBlocking();
              }
            }
            break;
          }
        }
      }
  });
}

function eventStart(){
  if(blockInterval != null){
    stopBlocking();
    setBadge('');
    syncBlockedData();
  }
}

function updateTime(){
  chrome.windows.getCurrent(function(browser){
    var popupOpen = chrome.extension.getViews({ type: "popup" }).length != 0;

    if(browser.focused || popupOpen){
      block.timeDay += 1;
      setBadge(getMinutesAndSeconds(block.timeDay, block.timeTotal));
      chrome.runtime.sendMessage({
         listId: block.listId,
         time: getMinutesAndSeconds(block.timeDay, block.timeTotal)
      });

      if(currentDate != getDateFormat(new Date())){
        resetDayTimes();
      }

      if(block.timeTotal-block.timeDay == 300){
        createNotification("Time Snatch (5 minutes)", block.url + " will be blocked in 5 minutes! Enjoy while you still can!");
      }else if(block.timeTotal-block.timeDay == 60){
        createNotification("Time Snatch (1 minute)", block.url + " will be blocked in 1 minute! Better wrap up your browsing!");
      }else if(block.timeTotal-block.timeDay == 10){
        createNotification("Time Snatch (10 seconds)", block.url + " will be blocked in 10 seconds! Hurry up!");
      }

      if(block.timeDay >= block.timeTotal){
        setBadge('');
        redirectTo(block.redirectUrl, block.tabId);
      }
    }
  });
}

function syncBlockedData(){
  i = block.listId;
  blockList = block.blockList

  blockList[i] = {
    "url": blockList[i].url,
    "redirectUrl": blockList[i].redirectUrl,
    "timeTotal": blockList[i].timeTotal,
    "timeDay": block.timeDay,
  }

  chrome.storage.sync.set({'blockList': blockList});
}

function redirectTo(url, tabId){
  if(url == "default"){
    chrome.tabs.update(tabId, {"url" : chrome.extension.getURL('default.html')}, function () {});
  }else{
    chrome.tabs.update(tabId, {"url" : 'http://' + url}, function () {});
  }
}

function resetDayTimes(){
  currentDate = getDateFormat(new Date());
  chrome.storage.sync.set({'date': currentDate});

  if(block != null){
    block.timeDay = 0;
  }

  chrome.storage.sync.get('blockList', function(data){
      if(data.blockList && data.blockList.length){
        var blockList = data.blockList;
        for(i in blockList){
          blockList[i].timeDay = 0;
        }

        chrome.storage.sync.set({'blockList': blockList});
      }
  });
}

function setBadge(text){
  chrome.browserAction.setBadgeText({"text": text});
}

function getMinutesAndSeconds(day, total){
  var minutes = (Math.floor((total-day) / 60)).toString()
  var seconds = ((total - day) % 60);
  if(seconds < 10){
    seconds = '0' + seconds.toString();
  }
  return minutes + ":" + seconds;
}

function getDomain(url) {
    var domain = extractHostname(url),
        splitArr = domain.split('.'),
        arrLen = splitArr.length;

    //extracting the root domain here
    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
    }
    return domain;
}

function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("://") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname;
}

function createNotification(title, message){
  notificationOptions = {
    type: 'basic',
    iconUrl: '../images/logo128-full.png',
    title: title,
    message: message
  };

  chrome.notifications.create('reminder', notificationOptions);
}

function getDateFormat(date){
  return date.getDay().toString() + "/" + date.getMonth().toString() + "/" + date.getFullYear().toString();
}

function startBlocking(){
  blockInterval = setInterval( updateTime, 1000 );
}

function stopBlocking(){
  clearInterval(blockInterval);
  blockInterval = null;
}
