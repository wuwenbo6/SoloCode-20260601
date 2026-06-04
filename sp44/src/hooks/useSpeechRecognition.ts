import { useEffect, useRef, useCallback, useState } from 'react';
import { useMeetingStore } from '@/store/meetingStore';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const { currentCaption, setCurrentCaption, addCaption, userName } = useMeetingStore();

  const startListening = useCallback(() => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (interimTranscript) {
        setTranscript(interimTranscript);
        setCurrentCaption(interimTranscript);
      }

      if (finalTranscript) {
        addCaption({
          id: crypto.randomUUID(),
          speakerId: 'local',
          speakerName: userName || 'You',
          text: finalTranscript.trim(),
          timestamp: Date.now(),
          isFinal: true,
        });
        setTranscript('');
        setCurrentCaption('');
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.error('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition && useMeetingStore.getState().isCaptioning) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);

    try {
      recognition.start();
    } catch {}
  }, [setCurrentCaption, addCaption, userName]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    transcript: transcript || currentCaption,
    startListening,
    stopListening,
    isSupported: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
  };
}
