
import React, { useState, useCallback } from 'react';
import { UploadedFile } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { DocumentArrowUpIcon, DocumentTextIcon, XCircleIcon } from './icons/Icons';

interface ResourcesProps {
    files: UploadedFile[];
    subjectId: string;
    onAddResource: (subjectId: string, file: UploadedFile) => void;
}

const Resources: React.FC<ResourcesProps> = ({ files, subjectId, onAddResource }) => {
    const [newFile, setNewFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        setError(null);
        
        if (selectedFile.size > 10 * 1024 * 1024) { 
            setError('File size must be less than 10MB.');
            return;
        }

        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(selectedFile.type)) {
            setError('Only JPEG, PNG, WebP, and PDF files are supported.');
            return;
        }
        
        setNewFile(selectedFile);
    }, []);

    const handleAddClick = async () => {
        if (!newFile) {
            setError("Please select a file to add.");
            return;
        }

        setError(null);
        setIsProcessing(true);

        try {
            const base64 = await fileToBase64(newFile);
            onAddResource(subjectId, {
                name: newFile.name,
                base64,
                mimeType: newFile.type,
            });
            setNewFile(null);
        } catch (err) {
            console.error(err);
            setError('Failed to process the file.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-2xl font-extrabold mb-6 text-slate-800">Subject Resources</h3>
                <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    <ul className="divide-y-2 divide-slate-100">
                        {files.map((file, index) => (
                            <li key={index} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                                <div className="bg-sky-100 p-2 rounded-xl">
                                     <DocumentTextIcon className="w-6 h-6 text-sky-500 flex-shrink-0" />
                                </div>
                                <span className="flex-1 truncate text-slate-700 font-bold">{file.name}</span>
                                {index === 0 && (
                                    <span className="text-xs font-extrabold bg-sky-100 text-sky-600 px-3 py-1 rounded-full uppercase tracking-wide">
                                        Primary
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="border-t-2 border-slate-200 pt-8">
                 <h3 className="text-xl font-extrabold mb-6 text-slate-800">Add More Resources</h3>
                 <div className="space-y-4">
                     <label
                        htmlFor="resource-upload"
                        className="relative cursor-pointer bg-white hover:bg-slate-50 border-2 border-dashed border-slate-300 hover:border-sky-400 rounded-3xl p-8 transition-all duration-300 block group text-center"
                        >
                        <div className="flex flex-col items-center">
                            <div className="bg-slate-50 p-4 rounded-full border-2 border-slate-200 mb-4 group-hover:scale-110 transition-transform">
                                <DocumentArrowUpIcon className="w-8 h-8 text-slate-400 group-hover:text-sky-500 transition-colors" />
                            </div>
                            <span className="font-bold text-slate-700 text-lg">
                            {newFile ? newFile.name : 'Upload study material'}
                            </span>
                            <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                            PDF, PNG, JPG, or WEBP (Max 10MB)
                            </p>
                        </div>
                        <input
                            id="resource-upload"
                            name="resource-upload"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept="image/png, image/jpeg, image/webp, application/pdf"
                        />
                    </label>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-500 font-bold justify-center">
                            <XCircleIcon className="w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    )}
                    
                    <button 
                        onClick={handleAddClick}
                        disabled={isProcessing || !newFile}
                        className="w-full bg-sky-500 hover:bg-sky-400 text-white font-bold py-4 px-6 rounded-2xl transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed border-b-4 border-sky-700 active:border-b-0 active:translate-y-1"
                    >
                        {isProcessing ? 'Processing...' : 'ADD RESOURCE'}
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default Resources;
