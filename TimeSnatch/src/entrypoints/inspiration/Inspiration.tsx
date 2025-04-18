import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
import { useTypewriter } from 'react-simple-typewriter'

function Inspiration() {

  const [selectedQuote, setSelectedQuote] = useState({
    quote: 'You cannot escape the responsibility of tomorrow by evading it today.',
    author: "Abraham Lincoln"
  });
  const [showAuthor, setShowAuthor] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReason(params.get('reason') || '');

    browser.storage.local.get(['quotes'], (data) => {
      if (data.quotes && data.quotes.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.quotes.length);
        setSelectedQuote(data.quotes[randomIndex]);
      }
    });
  }, []);


  // Typewriter effects
  const [quote] = useTypewriter({
    words: [selectedQuote.quote],
    typeSpeed: 30,
    loop: 1,
    onLoopDone: () => setShowAuthor(true)
  });

  const [author] = useTypewriter({
    words: [selectedQuote.author],
    typeSpeed: 60,
    loop: 1
  });


  return (
    <>
      <div className="flex h-screen items-center justify-start max-w-screen-lg mx-auto font-geistmono text-4xl text-muted-foreground font-light">
        <div className="flex flex-col items-center">
          {quote}
          {showAuthor && (
            <div className="flex items-center justify-end mt-5 w-full text-3xl font-extralight">
              - {author}
            </div>
          )}
        </div>
      </div>
      {reason && (
        <div className="absolute bottom-4 right-4 text-base font-geistmono text-muted-foreground">
          {reason}
        </div>
      )}
    </>
  );
}

export default Inspiration;
