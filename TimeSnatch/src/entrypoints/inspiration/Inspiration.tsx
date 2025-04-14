import { useState, useEffect } from 'react'
import './style.css';
import '~/assets/global.css';
import { useTypewriter } from 'react-simple-typewriter'
import { quotes } from './quotes'


function Inspiration() {

  // Select a random quote on component mount
  const [selectedQuote, setSelectedQuote] = useState(quotes[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setSelectedQuote(quotes[randomIndex]);
  }, []);

  // State for author visibility
  const [showAuthor, setShowAuthor] = useState(false);

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

  // State for reason
  const [reason, setReason] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReason(params.get('reason') || '');
  }, []);

  return (
    <>
      <div className="flex h-screen items-center justify-start max-w-screen-lg mx-auto font-geistmono text-4xl text-muted-foreground font-light">
        <div className="flex flex-col items-center">
          {quote}
          {showAuthor && (
            <div className="flex items-center justify-end mt-5 w-full text-3xl font-extralight">
              {author}
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
