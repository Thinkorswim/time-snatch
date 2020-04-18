$(function(){


  // On Load
  chrome.storage.sync.get('blockList', function(data){
      if(data.blockList && data.blockList.length){
        createBlockedListSection();

        var blockList = data.blockList;

        for (var i in blockList) {
          addBlockedRow(blockList[i], i);
        }
      }
  });

  $("#blockButton").click(function(){
    if($("#blockName").val() != '' && $("#blockTime").val() != '' && !isNaN(parseInt($("#blockTime").val()))){
      chrome.storage.sync.get('blockList', function(data){
        var blockList = [];

        if(data.blockList && data.blockList.length){
          blockList = data.blockList;
        }else{
          createBlockedListSection();
        }

        redirectUrl = "default";
        if($("#blockRedirect").val() != ''){
          redirectUrl = $("#blockRedirect").val();
        }

        var newBlock = {
          "url": getDomain($("#blockName").val()).toLowerCase(),
          "blockIncognito": $("#blockIncognito").is(':checked'),
          "redirectUrl": getDomain(redirectUrl).toLowerCase(),
          "timeTotal": Math.abs(parseInt($("#blockTime").val()))*60,
          "timeDay": 0
        };


        var st = $("#start_time").val();
        var et = $("#end_time").val();

        if (st != "" || et != ""){
          hs = parseInt(st.split(":")[0]);
          ms = parseInt(st.split(":")[1]);

          he = parseInt(et.split(":")[0]);
          me = parseInt(et.split(":")[1]);

          if (hs <= he) {
            if (hs == he) {
              if (ms < me) {
                newBlock.hs = hs;
                newBlock.ms = ms;
                newBlock.he = he;
                newBlock.me = me;
              }
            } else {
              newBlock.hs = hs;
              newBlock.ms = ms;
              newBlock.he = he;
              newBlock.me = me;
            }
          }
        }

        blockList.push(newBlock);
        blockList[0].date = getDateFormat(new Date());

        chrome.storage.sync.set({'blockList': blockList}, function(){
          location.reload();
        });
      });
    }
  });

  $(document).on('click', '.updateButton', function(){
    var blockId = parseInt($(this).attr('id').substr(11));
    var timeDifference = parseInt($('#blockRow'+blockId).attr("data-time-left"));

    // if(timeDifference > 0 ){
      var blockUrl = $('#blockRow'+blockId +' td:eq("0")').text();
      var blockTime = parseInt($('#blockRow'+blockId +' td:eq("1")').text().slice(0, -8));
      var blockRedirect = $('#blockRow'+blockId +' td:eq("3")').text();
      var blockIncognito = $('#blockRow'+ blockId +' td:eq("4")').text();

      if( blockIncognito == "true"){
        blockIncognito = "checked";
      }else{
        blockIncognito = "";
      }

      var updateRow = '<td id="websiteRow"><input type="text" value="' + blockUrl + '" autofocus required></td>';
      updateRow += '<td id="timeRow"><input type="number" value="' + blockTime + '" required></td>';
      updateRow += '<td></td>';
      if(blockRedirect == 'default'){
        updateRow += '<td id="redirectRow"><input type="text" placeholder="Optional"></td>';
      }else{
        updateRow += '<td id="redirectRow"><input type="text" value="' + blockRedirect + '" placeholder="Optional"></td>';
      }
      updateRow += '<td id="incognitoRow"><label class="container2"><input type="checkbox" id="blockIncognito" ' + blockIncognito + '><span class="checkmark2"></span></label></td>';
      updateRow += '<td class="cUpdate">';
      updateRow += '<button style="background-color: #e74c3c; border-color:#e74c3c!important;" id="deleteButton' + blockId + '" class="optionsButton deleteButton"><img src="../images/garbage.png"></button>';
      updateRow += '<button style="background-color: #27ae60; border-color:#27ae60!important;" id="saveButton' + blockId + '" class="optionsButton saveButton"><img src="../images/save.png"></button>';
      updateRow += '</td>';

      $('#blockRow'+blockId).html(updateRow);
    // }else{
    //     alert("Your daily allowance for this website has expired. You cannot change its settings until tomorrow. ")
    // }

  });

  $(document).on('click', '.saveButton', function(){
    var blockId = parseInt($(this).attr('id').substr(10));
    var blockUrl = $('#blockRow'+blockId +' td:eq("0") input:eq("0")').val();
    var blockTime = parseInt($('#blockRow'+blockId +' td:eq("1") input:eq("0")').val());
    var blockRedirect = $('#blockRow'+blockId +' td:eq("3") input:eq("0")').val();
    var blockIncognito = $('#blockRow'+blockId +' td:eq("4") input:eq("0")').is(':checked');

    chrome.storage.sync.get('blockList', function(data){
        var blockList = data.blockList;

        blockList[blockId].url = blockUrl;
        if(blockRedirect == ''){
          blockList[blockId].redirectUrl = 'default';
        }else{
          blockList[blockId].redirectUrl = blockRedirect;
        }
        blockList[blockId].timeTotal = blockTime*60;
        blockList[blockId].blockIncognito = blockIncognito;

        chrome.storage.sync.set({'blockList': blockList}, function(){
          location.reload();
        });
    });
  });

  $(document).on('click', '.deleteButton', function(){
    var blockId = parseInt($(this).attr('id').substr(12));

    chrome.storage.sync.get('blockList', function(data){
        var blockList = data.blockList;
        blockList.splice(blockId, 1);

        if (blockList[0]){
          blockList[0].date = getDateFormat(new Date());
        }

        chrome.storage.sync.set({'blockList': blockList}, function(){
          location.reload();
        });
    });

  });


  // Tweaks
  $('#blockForm').submit(function () {
   return false;
  });

  function createBlockedListSection(){
    var blockedListSection = '<div class="section"> List of blocked websites </div>';
    blockedListSection += '<div id="blockList"><table><tr>';
    blockedListSection += '<th> Blocked website </th>';
    blockedListSection += '<th> Allowed per day </th>';
    blockedListSection += '<th> Time left </th>';
    blockedListSection += '<th> Redirect </th>';
    blockedListSection += '<th> Incognito </th>';
    blockedListSection += '<th class="cUpdate"> </th>';
    blockedListSection += '</tr></table></div>';

    $(".body").append(blockedListSection);
  }

  function addBlockedRow(blockedWebsite, blockId){
    var timeLeft = getMinutesAndSeconds(blockedWebsite.timeDay, blockedWebsite.timeTotal);
    var minutes = Math.floor((blockedWebsite.timeTotal-blockedWebsite.timeDay) / 60);
    var seconds = (blockedWebsite.timeTotal-blockedWebsite.timeDay) % 60;

    if(minutes < 0 || (minutes == 0 && seconds == 0)){
      timeLeft = "None";
    }

    var rowAppend = '<tr data-time-left="' + (blockedWebsite.timeTotal-blockedWebsite.timeDay) + '" id="blockRow' + blockId +'">';
    rowAppend += '<td>' + blockedWebsite.url + "</td>";
    rowAppend += '<td>' + blockedWebsite.timeTotal/60 + " minutes </td>";
    rowAppend += '<td>' + timeLeft + "</td>";
    rowAppend += '<td>' + blockedWebsite.redirectUrl + "</td>";
    rowAppend += '<td id="incognitoRow">' + blockedWebsite.blockIncognito + "</td>";
    rowAppend += '<td class="cUpdate"> <button id="blockButton' + blockId + '" class="optionsButton updateButton">';
    rowAppend += '<img src="../images/edit.png">';
    rowAppend += '</button> </td>';
    rowAppend += "</tr>";

    $("#blockList table").append(rowAppend);
  }

  function getMinutesAndSeconds(day, total){
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

  function getDateFormat(date){
    return date.getDate().toString() + "/" + date.getMonth().toString() + "/" + date.getFullYear().toString();
  }

});
