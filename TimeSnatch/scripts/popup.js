$(function(){
  // On Load
  listBlockedWebsites();

  chrome.runtime.sendMessage({
    type: "checkBlocked",
  });

  chrome.storage.sync.get('blockList', function(data){
      if (typeof data.blockList[0] !== 'undefined' && data.blockList[0].date != getDateFormat(new Date())){
        resetDayTimes();
      }
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

    if(request.type == "updateTime"){
      $("#blocked" + request.listId + ' td:eq("1")').html(request.time);
      if (request.totalTime) {
          $("#blockedglobal" + ' td:eq("1")').html(request.totalTime);
      }
    }else if(request.type == "bold"){
      $("#blocked" + request.listId).css('font-weight', '500');
      $("#blocked" + request.listId).css('color', '#2980b9');
    }
  });



  $(".popupButton, #cogButton").click(function(){
    chrome.runtime.openOptionsPage();
  });


  function resetDayTimes(){
      var currentDate = getDateFormat(new Date());
      chrome.storage.sync.set({'date': currentDate});

      chrome.storage.sync.get('blockList', function(data){
          if(data.blockList && data.blockList.length){
            var blockList = data.blockList;
            for(var i in blockList){
              blockList[i].timeDay = 0;
            }

            chrome.storage.sync.set({'blockList': blockList});
          }

          listBlockedWebsites();
      });
  }


  function listBlockedWebsites(){
    chrome.storage.sync.get(['blockList', 'globalOptions'], function(data){
        if(data.blockList && data.blockList.length){
          var blockList = data.blockList;
          $("#popupList table").html('');
          var totalTime = 0;

          for (var i in blockList) {
              var timeLeft = getMinutesAndSeconds(blockList[i].timeDay, blockList[i].timeTotal);
              totalTime += blockList[i].timeDay;
              var minutes = Math.floor((blockList[i].timeTotal-blockList[i].timeDay) / 60);
              var seconds = (blockList[i].timeTotal-blockList[i].timeDay) % 60;

              if(minutes < 0 || (minutes == 0 && seconds == 0)){
                timeLeft = "None";
              }

              var popupRow = '<tr id="blocked' + i + '">';
              popupRow += '<td class="pBlocked">' + blockList[i].url + '</td>';
              popupRow += '<td class="pTime">' + timeLeft + '</td>';
              popupRow += "</tr>";

              $("#popupList table").append(popupRow);
          }
          if(data.globalOptions && data.globalOptions.budget){
              var globalTimeLeft = getMinutesAndSeconds(totalTime, data.globalOptions.budget*60);
              var globalPopupRow = '<tr id="blockedglobal" class="pGlobalBudgetRow">';
              globalPopupRow += '<td class="pBlocked">Global</td>';
              globalPopupRow += '<td class="pTime">' + globalTimeLeft + '</td>';
              globalPopupRow += "</tr>";
              $("#popupList table").prepend(globalPopupRow);
          }
        }else{
          var apopupRow = '<td class="noBlocked"> No blocked websites :( </td>';
          $("#popupList table").append(apopupRow);
        }
    });
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

  function getDateFormat(date){
    return date.getDate().toString() + "/" + date.getMonth().toString() + "/" + date.getFullYear().toString();
  }

});
