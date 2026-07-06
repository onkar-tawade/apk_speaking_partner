import React, { useEffect, useRef, useState } from 'react';
import './VoiceNoteBubble.css';

const BAR_COUNT = 32;

/**
 * Plays back the actual audio the user recorded, with a real waveform computed
 * from the recording itself (not decorative) - matches the "voice note" style
 * from apps like Supernova AI, and doubles as a way to verify exactly what was
 * captured versus what got transcribed.
 */
export default function VoiceNoteBubble({ audioUrl }) {
  const audioRef = useRef(null);
  const [peaks, setPeaks] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function decode() {
      try {
        const res = await fetch(audioUrl);
        const arrayBuffer = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(rawData.length / BAR_COUNT));
        const newPeaks = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const start = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const v = Math.abs(rawData[start + j] || 0);
            if (v > max) max = v;
          }
          newPeaks.push(max);
        }
        const maxPeak = Math.max(...newPeaks, 0.01);
        if (!cancelled) setPeaks(newPeaks.map((p) => p / maxPeak));
        ctx.close();
      } catch (err) {
        console.error('Waveform decode failed:', err);
        if (!cancelled) setPeaks(new Array(BAR_COUNT).fill(0.4));
      }
    }
    decode();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    setProgress(audio.currentTime / audio.duration);
  };

  const formatTime = (s) => {
    if (!s || !isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const displayPeaks = peaks || new Array(BAR_COUNT).fill(0.25);

  return (
    <div className="voice-note">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
      />
      <button className="voice-note-play" onClick={handleTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <div className="voice-note-bars">
        {displayPeaks.map((p, i) => (
          <span
            key={i}
            className={i / BAR_COUNT < progress ? 'played' : ''}
            style={{ height: `${Math.max(p * 100, 14)}%` }}
          />
        ))}
      </div>
      <span className="voice-note-duration">{formatTime(duration)}</span>
    </div>
  );
}
