$(function(){
  // On Load
  listBlockedWebsites();

  chrome.runtime.sendMessage({
    type: "checkBlocked",
  });

  chrome.storage.sync.get('date', function(data){
    var currentDate = getDateFormat(new Date());

    if(data.date && currentDate != data.date){
        resetDayTimes();
    }
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

    if(request.type == "updateTime"){
      $("#blocked" + request.listId + ' td:eq("1")').html(request.time);
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
            for(i in blockList){
              blockList[i].timeDay = 0;
            }

            chrome.storage.sync.set({'blockList': blockList});
          }

          listBlockedWebsites();
      });
  }


  function listBlockedWebsites(){
    chrome.storage.sync.get('blockList', function(data){
        if(data.blockList && data.blockList.length){
          var blockList = data.blockList;
          $("#popupList table").html('');

          for (i in blockList) {
              var timeLeft = getMinutesAndSeconds(blockList[i].timeDay, blockList[i].timeTotal);
              var minutes = Math.floor((blockList[i].timeTotal-blockList[i].timeDay) / 60);
              var seconds = (blockList[i].timeTotal-blockList[i].timeDay) % 60;

              if(minutes < 0 || (minutes == 0 && seconds == 0)){
                timeLeft = "None";
              }

              var popupRow = '<tr id="blocked' + i + '">';
              popupRow += '<td class="pBlocked">' + blockList[i].url + '</td>';
              popupRow += '<td class="pTime">' + timeLeft + '</td>';
              popupRow += "</tr>"

              $("#popupList table").append(popupRow);
          }
        }else{
          var popupRow = '<td class="noBlocked"> No blocked websites :( </td>';
          $("#popupList table").append(popupRow);
        }
    });
  }

  function getMinutesAndSeconds(day, total){
    var minutes = (Math.floor((total-day) / 60)).toString()
    var seconds = ((total - day) % 60);
    if(seconds < 10){
      seconds = '0' + seconds.toString();
    }
    return minutes + ":" + seconds;
  }

  function getDateFormat(date){
    return date.getDay().toString() + "/" + date.getMonth().toString() + "/" + date.getFullYear().toString();
  }

});
