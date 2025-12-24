
import React, { useEffect, useState } from 'react';
import { UploadedFile } from '../types';
import { base64ToBlob } from '../utils/fileUtils';

interface DocumentViewerProps {
  file: UploadedFile;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ file }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isImage = file.mimeType.startsWith('image/');
  
  useEffect(() => {
    let url: string | null = null;
    if (!isImage) {
        // Create a blob URL for PDFs/Text to avoid "Page Blocked" errors with large Data URIs
        try {
            const blob = base64ToBlob(file.base64, file.mimeType);
            url = URL.createObjectURL(blob);
            setObjectUrl(url);
        } catch (e) {
            console.error("Failed to create blob for viewer", e);
        }
    }
    return () => {
        if (url) URL.revokeObjectURL(url);
    };
  }, [file, isImage]);

  const dataUri = isImage ? `data:${file.mimeType};base64,${file.base64}` : objectUrl;

  return (
    <div className="w-full h-full bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-sm">
      <div className="flex-shrink-0 bg-slate-50 p-3 border-b border-slate-200">
        <h3 className="font-bold text-slate-500 truncate text-center text-xs uppercase tracking-wide">{file.name}</h3>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-50/50 custom-scrollbar">
        {isImage ? (
          <div className="flex justify-center items-center h-full">
            <img src={dataUri || ''} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg shadow-sm border border-slate-200" />
          </div>
        ) : (
          dataUri && (
            <iframe
                src={dataUri}
                title={file.name}
                className="w-full h-full border-0 rounded-lg bg-white shadow-sm"
            />
          )
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
