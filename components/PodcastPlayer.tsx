
import React, { useState, useCallback } from 'react';
import { generatePodcastAudio } from '../services/geminiService';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { decode } from '../utils/audioUtils';
import { PlayIcon, StopIcon, SpeakerWaveIcon, ArrowPathIcon } from './icons/Icons';

interface PodcastPlayerProps {
    textToSpeak: string;
}

const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ textToSpeak }) => {
    const [isLoading, setIsLoading] = useState(false);
    const { isPlaying, play, stop } = useAudioPlayer({ sampleRate: 24000 });

    const handlePlay = useCallback(async () => {
        if (!textToSpeak) return;
        setIsLoading(true);
        try {
            const audioBase64 = await generatePodcastAudio(textToSpeak);
            if (audioBase64) {
                const audioBytes = decode(audioBase64);
                play(audioBytes);
            } else {
                console.error("Failed to generate audio.");
            }
        } catch (error) {
            console.error("Error in handlePlay:", error);
        } finally {
            setIsLoading(false);
        }
    }, [textToSpeak, play]);

    const handleStop = useCallback(() => {
        stop();
    }, [stop]);

    return (
        <div className="flex items-center space-x-4 p-2 rounded-lg bg-slate-700/50">
            <div className="flex-shrink-0 bg-cyan-500 rounded-full p-3">
                <SpeakerWaveIcon className="w-6 h-6 text-white"/>
            </div>
            <div className="flex-1">
                 <h4 className="font-bold text-white">Revision Podcast</h4>
                 <p className="text-sm text-slate-400">Listen to your generated notes.</p>
            </div>
            <button
                onClick={isPlaying ? handleStop : handlePlay}
                disabled={isLoading}
                className="p-3 rounded-full bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
                {isLoading ? (
                    <ArrowPathIcon className="w-6 h-6 animate-spin" />
                ) : isPlaying ? (
                    <StopIcon className="w-6 h-6" />
                ) : (
                    <PlayIcon className="w-6 h-6" />
                )}
            </button>
        </div>
    );
};

export default PodcastPlayer;