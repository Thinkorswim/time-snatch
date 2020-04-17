$(function(){
  var quotes = [
    {
      "quote": 'Never put off till tomorrow what may be done day after tomorrow just as well',
      "author": "Mark Twain"
    },
    {
      "quote": 'Things may come to those who wait, but only the things left by those who hustle',
      "author": "Abraham Lincoln"
    },
    {
      "quote": 'My advice is to never do tomorrow what you can do today. Procrastination is the thief of time',
      "author": "Charles Dickens"
    },
    {
      "quote": 'Never put off for tomorrow, what you can do today',
      "author": "Thomas Jefferson"
    },
    {
      "quote": 'Procrastination is the bad habit of putting of until the day after tomorrow what should have been done the day before yesterday',
      "author": "Napoleon Hill"
    },
    {
      "quote": 'A year from now you may wish you had started today',
      "author": "Karen Lamb"
    },
    {
      "quote": 'Do not wait.The time will never be just right',
      "author": "Napoleon Hill"
    },
    {
      "quote": 'Nothing is so fatiguing as the eternal hanging on of an uncompleted task',
      "author": "William James"
    },
    {
      "quote": 'It is easier to resist at the beginning than at the end',
      "author": "Leonardo da Vinci"
    },
    {
      "quote": 'You cannot escape the responsibility of tomorrow by evading it today',
      "author": "Abraham Lincoln"
    },
    {
      "quote": 'You can\'t just turn on creativity like a faucet. You have to be in the right mood. What mood is that? Last-minute panic',
      "author": "Bill Watterson"
    },
    {
      "quote": 'The two rules of procrastination: 1) Do it today 2) Tomorrow will be today tomorrow',
      "author": "Unknown"
    },
    {
      "quote": 'What may be done at any time will be done at no time',
      "author": "Scottish Proverb"
    },
    {
      "quote": 'The best way to get something done is to begin',
      "author": "Unknown"
    },
    {
      "quote": 'How soon not now, becomes never',
      "author": "Martin Luther"
    },
    {
      "quote": 'In delay there lies no plenty',
      "author": "William Shakespeare"
    },
    {
      "quote": 'You may delay, but time will not',
      "author": "Benjamin Franklin"
    },
    {
      "quote": 'Procrastination is opportunity\'s assassin',
      "author": "Victor Kiam"
    },
    {
      "quote": 'Following-through is the only thing that separates dreamers from people that accomplish great things',
      "author": "Gene Hayden"
    },
    {
      "quote": 'Until you value yourself, you will not value your time. Until you value your time, you will not do anything with it',
      "author": "M. Scott Peck"
    },
  ];

var quote = Math.floor((Math.random() * quotes.length));
var background = "g" + Math.floor((Math.random() * 21) + 1);

$("body").addClass(background);

var quoteHtml = "<div>&#8220; ";
quoteHtml +=  quotes[quote].quote;
quoteHtml += ".	&#8221;</div>";
quoteHtml += '<div class="quoteAuthor"> - ';
quoteHtml += quotes[quote].author;
quoteHtml += "</div>";

$(".quoteCenter").html(quoteHtml);


//
});
