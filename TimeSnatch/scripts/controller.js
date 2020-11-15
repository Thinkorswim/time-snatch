chrome.runtime.onInstalled.addListener(function (object) {
    if(object.reason === 'install'){
      chrome.runtime.openOptionsPage();
    }else if(object.reason == "update"){
      chrome.storage.sync.get('blockList', function(data){
        if(typeof data.blockList[0] !== 'undefined' && data.blockList[0] !== 'undefined'){
          data.blockList[0].date = getDateFormat(new Date());
          chrome.storage.sync.set({'blockList': data.blockList});
        }
      });
    }
});

blockInterval = null;
block = null;
globalTimeBudget = null;
globalTimeUsed = 0;

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

function checkGlobalBudget(redirectUrl, tabId) {
  if (globalTimeBudget && globalTimeUsed >= globalTimeBudget) {
    redirectTo(redirectUrl, tabId);
  }
}

function checkBlocked(tab){
  chrome.storage.sync.get(['blockList', 'globalOptions'], function(data){
      if(typeof data.blockList !== 'undefined' && typeof data.blockList[0] !== 'undefined' && data.blockList[0].date != getDateFormat(new Date())){
        resetDayTimes();
      }
      if(data.globalOptions && data.globalOptions.budget) {
        globalTimeBudget = data.globalOptions.budget * 60;
      }

      if(data.blockList && data.blockList.length){
        var blockList = data.blockList;
        var sumOfTimes = 0;
        var matchedSite = null;
        for(var i in blockList){
          var currentBlock = blockList[i];
          sumOfTimes += currentBlock.timeDay;
          if (getDomain(tab.url) == currentBlock.url){
            matchedSite = currentBlock;
            var today = new Date();
            var hc = parseInt(today.getHours());
            var mc = parseInt(today.getMinutes());

            if (currentBlock.hs != undefined && currentBlock.he != undefined &&
                currentBlock.ms != undefined && currentBlock.me != undefined ){
              if (currentBlock.hs == hc && currentBlock.he == hc){
                if (currentBlock.ms <= mc && currentBlock.me >= mc){
                  redirectTo(currentBlock.redirectUrl, tab.id);
                  continue;
                }
              } else if (currentBlock.hs == hc) {
                if (currentBlock.ms <= mc){
                  redirectTo(currentBlock.redirectUrl, tab.id);
                  continue;
                }
              } else if (currentBlock.he == hc) {
                if (currentBlock.me >= mc){
                  redirectTo(currentBlock.redirectUrl, tab.id);
                  continue;
                }
              } else if (currentBlock.hs < hc && currentBlock.he > hc) {
                redirectTo(currentBlock.redirectUrl, tab.id);
                continue;
              }
            }

            setBadgeForTime(currentBlock.timeDay, currentBlock.timeTotal);

            if(currentBlock.timeDay >= currentBlock.timeTotal){
              setBadge('');
              if(!(currentBlock.blockIncognito == false && tab.incognito == true)){
                redirectTo(currentBlock.redirectUrl, tab.id);
              }

            }else{
              block = {
                "tabId": tab.id,
                "listId": i,
                "url": currentBlock.url,
                "timeDay": currentBlock.timeDay,
                "timeTotal": currentBlock.timeTotal,
                "redirectUrl": currentBlock.redirectUrl,
                "blockList": blockList,
                "blockIncognito": currentBlock.blockIncognito,
                "date": blockList[0].date
              };

              if (currentBlock.hs != undefined && currentBlock.ms != undefined &&
                  currentBlock.he != undefined && currentBlock.me != undefined) {
                  block.hs = currentBlock.hs;
                  block.ms = currentBlock.ms;
                  block.he = currentBlock.he;
                  block.me = currentBlock.me;
              }


              if(blockInterval == null){
                if(!(currentBlock.blockIncognito == false && tab.incognito == true)){
                  startBlocking();
                }
              }
            }
          }
        }
        globalTimeUsed = sumOfTimes;
        if (matchedSite && !(matchedSite.blockIncognito === false && tab.incognito === true)) {
          checkGlobalBudget(matchedSite.redirectUrl, tab.id);
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

function triggerNotification(limit, time, url) {
  var msg = url + " will be blocked";
  if (globalTimeBudget && (globalTimeBudget - globalTimeUsed) <= (limit - time)) {
    time = globalTimeUsed;
    limit = globalTimeBudget;
    msg = "Browsing will be limited";
  }
  if (limit - time === 300) {
    createNotification("Time Snatch (5 minutes)", msg + " in 5 minutes! Enjoy while you still can!");
  } else if (limit - time === 60) {
    createNotification("Time Snatch (1 minute)", msg + " in 1 minute! Better wrap up your browsing!");
  } else if (limit - time === 10) {
    createNotification("Time Snatch (10 seconds)", msg + " in 10 seconds! Hurry up!");
  }
}

function updateTime(){
  chrome.windows.getCurrent(function(browser){
    var popupOpen = chrome.extension.getViews({ type: "popup" }).length != 0;

    if(browser.focused || popupOpen){
      block.timeDay += 1;
      globalTimeUsed += 1;
      setBadgeForTime(block.timeDay, block.timeTotal);
      chrome.runtime.sendMessage({
        type: "updateTime",
        listId: block.listId,
        time: getMinutesAndSeconds(block.timeDay, block.timeTotal),
        totalTime: globalTimeBudget ? getMinutesAndSeconds(globalTimeUsed, globalTimeBudget) : null
      });

      triggerNotification(block.timeTotal, block.timeDay, block.url);

      if(block.timeDay >= block.timeTotal){
        setBadge('');
        redirectTo(block.redirectUrl, block.tabId);
      } else {
        checkGlobalBudget(block.redirectUrl, block.tabId)
      }
    }
  });
}

function syncBlockedData(){
  i = block.listId;
  blockList = block.blockList;

  if(typeof blockList.blockList !== 'undefined' && blockList.blockList[0].date != getDateFormat(new Date())){
    resetDayTimes();
  }else{
    if (blockList[i].hs != undefined && blockList[i].ms != undefined &&
        blockList[i].he != undefined && blockList[i].me != undefined) {

        blockList[i] = {
          "url": blockList[i].url,
          "redirectUrl": blockList[i].redirectUrl,
          "timeTotal": blockList[i].timeTotal,
          "timeDay": block.timeDay,
          "blockIncognito": blockList[i].blockIncognito,
          "hs": blockList[i].hs,
          "ms": blockList[i].ms,
          "he": blockList[i].he,
          "me": blockList[i].me
        };

        if(i == 0){
          blockList[0].date = getDateFormat(new Date());
        }

        chrome.storage.sync.set({'blockList': blockList});
    } else {
      blockList[i] = {
        "url": blockList[i].url,
        "redirectUrl": blockList[i].redirectUrl,
        "timeTotal": blockList[i].timeTotal,
        "timeDay": block.timeDay,
        "blockIncognito": blockList[i].blockIncognito,
      };

      if(i == 0){
        blockList[0].date = getDateFormat(new Date());
      }

      chrome.storage.sync.set({'blockList': blockList});
    }
  }
}

function redirectTo(url, tabId){
  if(url == "default"){
    chrome.tabs.update(tabId, {"url" : chrome.extension.getURL('default.html')}, function () {});
  }else{
    chrome.tabs.update(tabId, {"url" : 'http://' + url}, function () {});
  }
}

function resetDayTimes(){
  if(block != null){
    block.timeDay = 0;
  }
  globalTimeUsed = 0;
  chrome.storage.sync.get('blockList', function(data){
      data.blockList[0].date = getDateFormat(new Date());

      if(data.blockList && data.blockList.length){
        var blockList = data.blockList;
        for(var i in blockList){
          blockList[i].timeDay = 0;
        }

        chrome.storage.sync.set({'blockList': blockList});
      }
  });
}

function setBadge(text, globalLimit = false){
  chrome.browserAction.setBadgeBackgroundColor({ color: (globalLimit ? "#e74c3c" : "#e79c3c")});
  chrome.browserAction.setBadgeText({"text": text});
}

function setBadgeForTime(time, limit) {
  var global = false;
  if (globalTimeBudget && (globalTimeBudget - globalTimeUsed) <= (limit - time)) {
    time = globalTimeUsed;
    limit = globalTimeBudget;
    global = true;
  }
  setBadge(getMinutesAndSeconds(time, limit), global);
}

function getMinutesAndSeconds(day, total){
  if (day >= total ) {
    return "0:00";
  }
  var minutes = (Math.floor((total-day) / 60)).toString();
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
  return date.getDate().toString() + "/" + date.getMonth().toString() + "/" + date.getFullYear().toString();
}

function startBlocking(){
  blockInterval = setInterval( updateTime, 1000 );
}

function stopBlocking(){
  clearInterval(blockInterval);
  blockInterval = null;
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if(request.type == "checkBlocked" && blockInterval != null){
    chrome.runtime.sendMessage({
      listId: block.listId,
      type: "bold"
    });
  }
});
