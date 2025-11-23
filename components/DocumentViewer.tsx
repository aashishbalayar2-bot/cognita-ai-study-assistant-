
import React from 'react';
import { UploadedFile } from '../types';

interface DocumentViewerProps {
  file: UploadedFile;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ file }) => {
  const isImage = file.mimeType.startsWith('image/');
  const dataUri = `data:${file.mimeType};base64,${file.base64}`;

  return (
    <div className="w-full h-full bg-white border-2 border-slate-200 rounded-3xl flex flex-col overflow-hidden shadow-sm">
      <div className="flex-shrink-0 bg-slate-50 p-4 border-b-2 border-slate-100">
        <h3 className="font-bold text-slate-700 truncate text-center text-sm uppercase tracking-wide">{file.name}</h3>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-slate-100/50">
        {isImage ? (
          <div className="flex justify-center items-center h-full">
            <img src={dataUri} alt={file.name} className="max-w-full max-h-full object-contain rounded-xl shadow-sm" />
          </div>
        ) : (
          <iframe
            src={dataUri}
            title={file.name}
            className="w-full h-full border-0 rounded-xl bg-white shadow-sm"
          />
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
