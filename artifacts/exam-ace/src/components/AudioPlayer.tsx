import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, Music, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const AudioPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [volume, setVolume] = useState(0.4);
  const [isHovered, setIsHovered] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // High quality lofi study tracks (Multi-source fallback)
  const sources = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://cdn.pixabay.com/audio/2022/02/22/audio_d0c6ff1bab.mp3",
    "https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a7312d.mp3"
  ];
  
  const [sourceIndex, setSourceIndex] = useState(0);

  // Auto-play attempt on first interaction
  useEffect(() => {
    const startAudio = () => {
      if (!isPlaying && status === 'idle' && audioRef.current) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          setStatus('playing');
        }).catch(() => {
          // Keep as idle if blocked
        });
      }
    };

    window.addEventListener('click', startAudio, { once: true });
    return () => window.removeEventListener('click', startAudio);
  }, [isPlaying, status]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the global window listener from triggering
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        setStatus('idle');
      } else {
        setStatus('loading');
        await audioRef.current.play();
        setIsPlaying(true);
        setStatus('playing');
      }
    } catch (err) {
      console.error("Audio Error:", err);
      setStatus('error');
      if (sourceIndex < sources.length - 1) {
        setSourceIndex(prev => prev + 1);
      }
    }
  };

  const handleAudioError = () => {
    setStatus('error');
    if (sourceIndex < sources.length - 1) {
      setSourceIndex(prev => prev + 1);
    }
  };

  return (
    <div 
      className="fixed top-20 right-6 z-50 flex items-center gap-3 transition-all duration-500"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <audio 
        ref={audioRef} 
        src={sources[sourceIndex]} 
        loop 
        onError={handleAudioError}
        onPlay={() => {
          setIsPlaying(true);
          setStatus('playing');
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
      />

      {/* Volume Slider - Slides out on hover */}
      <div 
        className={`flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-xl border border-foreground/5 transition-all duration-500 overflow-hidden ${
          isHovered ? 'max-w-[200px] opacity-100 translate-x-0' : 'max-w-0 opacity-0 translate-x-10 pointer-events-none'
        }`}
      >
        {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-slate-500" /> : <Volume2 className="w-3.5 h-3.5 text-primary" />}
        <Slider
          value={[volume * 100]}
          max={100}
          step={1}
          onValueChange={(vals) => setVolume(vals[0] / 100)}
          className="w-20"
        />
      </div>

      {/* Main Play/Pause Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <button
              onClick={togglePlay}
              className={`w-12 h-12 rounded-full border-2 transition-all duration-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] flex items-center justify-center relative z-10 ${
                isPlaying 
                  ? 'bg-primary/10 border-primary shadow-primary/20' 
                  : status === 'error' 
                    ? 'border-red-400 bg-red-50 text-red-500' 
                    : 'bg-card border-foreground/10 text-foreground hover:bg-muted'
              }`}
            >
              {status === 'loading' ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 text-primary fill-primary/20" />
              ) : status === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 text-slate-600 ml-1" />
              )}
            </button>
            
            {/* Soft Glow Effect */}
            {isPlaying && (
              <div className="absolute -inset-1 bg-primary/20 rounded-full blur-md animate-pulse -z-0" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-slate-900 text-white border-none px-3 py-1.5 rounded-lg text-xs">
          <div className="flex items-center gap-2">
            <Music className="w-3 h-3 text-primary" />
            <span>{isPlaying ? 'Pause Focus Mode' : 'Start Focus Mode'}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default AudioPlayer;
