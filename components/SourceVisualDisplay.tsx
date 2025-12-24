
import React, { useEffect, useState } from 'react';
import { UploadedFile, VisualReference } from '../types';
import { BookOpenIcon, DocumentTextIcon, EyeIcon } from './icons/Icons';
import { base64ToBlob } from '../utils/fileUtils';

interface SourceVisualDisplayProps {
    visual: VisualReference;
    files: UploadedFile[];
    compact?: boolean;
}

export const SourceVisualDisplay: React.FC<SourceVisualDisplayProps> = ({ visual, files, compact = false }) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    // Safety check: ensure file index is valid
    if (!visual || visual.fileIndex === undefined || visual.fileIndex < 0 || visual.fileIndex >= files.length) return null;

    const file = files[visual.fileIndex];
    const marginClass = compact ? "my-3" : "my-8";

    // Handle PDF Blob URL creation
    useEffect(() => {
        let url: string | null = null;
        if (visual.type === 'pdf_reference' && file.mimeType === 'application/pdf') {
            try {
                const blob = base64ToBlob(file.base64, 'application/pdf');
                url = URL.createObjectURL(blob);
                setPdfUrl(url);
            } catch (e) {
                console.error("Failed to create PDF blob", e);
            }
        }
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [visual, file]);
    
    // 1. Handle Image Files (Direct Render)
    if (visual.type === 'image_file' && file.mimeType.startsWith('image/')) {
        const heightClass = compact ? "max-h-60" : "max-h-[500px]";
        
        return (
            <div className={marginClass}>
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-700 relative group">
                     <img 
                        src={`data:${file.mimeType};base64,${file.base64}`} 
                        alt="Source Visual" 
                        className={`w-full h-auto ${heightClass} object-contain mx-auto bg-black/50`}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-center">
                         <p className="text-white/90 text-xs font-bold flex items-center justify-center gap-2">
                            <EyeIcon className="w-3 h-3 text-blue-400" />
                            {visual.description}
                         </p>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Handle PDF References (Embedded Page View)
    if (visual.type === 'pdf_reference' && file.mimeType === 'application/pdf' && pdfUrl) {
        // Construct URI to jump to specific page using the Blob URL
        const pdfFragment = `${pdfUrl}#page=${visual.pageNumber}&view=FitH`;
        const heightClass = compact ? "h-72" : "h-[500px]";

        return (
            <div className={marginClass}>
                <div className="bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-600">
                    {/* Header for context */}
                    {!compact && (
                        <div className="bg-slate-900 px-4 py-2 flex justify-between items-center border-b border-slate-700">
                            <div className="flex items-center gap-2">
                                <DocumentTextIcon className="w-4 h-4 text-blue-400" />
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    {file.name} • Page {visual.pageNumber}
                                </span>
                            </div>
                            <span className="text-xs text-slate-500 font-medium">Source Visual</span>
                        </div>
                    )}

                    {/* The Visual (Iframe of the specific page) */}
                    <div className={`relative ${heightClass} bg-slate-200`}>
                        <iframe 
                            src={pdfFragment} 
                            className="w-full h-full border-0"
                            title={`Visual Reference: Page ${visual.pageNumber}`}
                            loading="lazy"
                        />
                        {/* Overlay label at bottom just in case */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/75 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none whitespace-nowrap">
                            Page {visual.pageNumber}: {visual.description}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Fallback for text references or unsupported types
    return (
        <div className={`${marginClass} bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3 shadow-sm`}>
            <div className="bg-white p-1.5 rounded-lg border border-blue-100 shadow-sm flex-shrink-0">
                 <BookOpenIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
                 <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-wide mb-0.5">Source Reference</h4>
                 <p className="text-slate-700 font-bold text-sm leading-tight">
                    "{visual.description}"
                 </p>
                 <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                     <DocumentTextIcon className="w-3 h-3" />
                     <span className="truncate max-w-[200px]">{file.name}</span>
                     {visual.pageNumber && (
                         <>
                            <span>•</span>
                            <span className="font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                                Page {visual.pageNumber}
                            </span>
                         </>
                     )}
                 </div>
            </div>
        </div>
    );
};
