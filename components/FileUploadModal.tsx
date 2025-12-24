import React from 'react';
import FileUpload from './FileUpload';
import { UploadedFile } from '../types';
import { XMarkIcon } from './icons/Icons';

interface FileUploadModalProps {
  onClose: () => void;
  onSubjectAdded: (name: string, file: UploadedFile) => void;
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({ onClose, onSubjectAdded }) => {
  const handleSubjectAdded = (name: string, file: UploadedFile) => {
    onSubjectAdded(name, file);
    // The modal will be closed by the parent component's state change
  };
  
  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg"
        onClick={e => e.stopPropagation()} 
      >
        <FileUpload onSubjectAdded={handleSubjectAdded} />
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 bg-slate-100 text-slate-500 rounded-full p-2 hover:bg-slate-200 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default FileUploadModal;