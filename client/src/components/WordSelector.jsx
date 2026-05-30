import { useState, useEffect } from 'react';

export default function WordSelector({ words, onChoose, timeLimit = 15 }) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChoose = (word) => {
    setSelected(word);
    onChoose(word);
  };

  return (
    <div className="word-selector-overlay">
      <div className="word-selector-modal">
        <h2>Choose a word to draw!</h2>
        <p className="choose-timer">Time to choose: <strong>{timeLeft}s</strong></p>
        <div className="word-options">
          {words.map((word, i) => (
            <button
              key={i}
              className={`word-option ${selected === word ? 'selected' : ''}`}
              onClick={() => handleChoose(word)}
              disabled={!!selected}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
