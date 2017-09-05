$(function(){

  // On Load
  listBlockedWebsites();

  chrome.storage.sync.get('date', function(data){
    var currentDate = getDateFormat(new Date());

    if(data.date && currentDate != data.date){
        resetDayTimes();
        listBlockedWebsites()
    }

    chrome.storage.sync.set({'date': currentDate});
  });

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    $("#blocked" + request.listId + ' td:eq("1")').html(request.time);
    // $("#blocked" + request.listId).css('background-color', '#2980b9');
    // $("#blocked" + request.listId).css('color', 'white');
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
      });
  }


  function listBlockedWebsites(){
    chrome.storage.sync.get('blockList', function(data){
        if(data.blockList && data.blockList.length){
          var blockList = data.blockList;
          $("#popupList table").html('');

          for (i in blockList) {
              var popupRow = '<tr id="blocked' + i + '">';
              popupRow += '<td class="pBlocked">' + blockList[i].url + '</td>';
              popupRow += '<td class="pTime">' + getMinutesAndSeconds(blockList[i].timeDay, blockList[i].timeTotal) + '</td>';
              popupRow += "</tr>"

              $("#popupList table").append(popupRow);
          }
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
