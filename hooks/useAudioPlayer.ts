import { useState, useRef, useCallback, useEffect } from 'react';
import { decodeAudioData } from '../utils/audioUtils';

interface UseAudioPlayerProps {
    sampleRate: number;
}

export const useAudioPlayer = ({ sampleRate }: UseAudioPlayerProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

    useEffect(() => {
        // Initialize AudioContext
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });

        return () => {
            // Cleanup on unmount
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, [sampleRate]);

    const resume = useCallback(() => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
    }, []);

    const play = useCallback(async (audioData: Uint8Array) => {
        if (!audioContextRef.current) return;
        
        // Ensure context is running (fixes autoplay blocks)
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        if (sourceNodeRef.current) {
            sourceNodeRef.current.stop();
        }

        try {
            const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, sampleRate, 1);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsPlaying(false);
            source.start();
            sourceNodeRef.current = source;
            setIsPlaying(true);
        } catch (error) {
            console.error("Error playing audio:", error);
            setIsPlaying(false);
        }
    }, [sampleRate]);

    const stop = useCallback(() => {
        if (sourceNodeRef.current) {
            sourceNodeRef.current.stop();
            sourceNodeRef.current = null;
            setIsPlaying(false);
        }
    }, []);

    return { isPlaying, play, stop, resume };
};