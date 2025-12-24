import React, { useState, useCallback } from 'react';
import { UploadedFile } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import { DocumentArrowUpIcon, BookOpenIcon } from './icons/Icons';

interface FileUploadProps {
  onSubjectAdded: (name: string, file: UploadedFile) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onSubjectAdded }) => {
  const [subjectName, setSubjectName] = useState('');
  const [file, setFile] = useState<File | null>(null);
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

    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'].includes(selectedFile.type) && !selectedFile.name.endsWith('.md')) {
        setError('Only PDF, Images, TXT, and MD files are supported.');
        return;
    }
    
    setFile(selectedFile);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !subjectName.trim()) {
        setError("Please provide a subject name and select a file.");
        return;
    }

    setError(null);
    setIsProcessing(true);

    try {
      const base64 = await fileToBase64(file);
      onSubjectAdded(subjectName, {
        name: file.name,
        base64,
        mimeType: file.type,
      });
      setSubjectName('');
      setFile(null);
    } catch (err) {
      console.error(err);
      setError('Failed to process the file.');
    } finally {
        setIsProcessing(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-full max-w-lg text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-lg">
        <h2 className="text-2xl font-extrabold mb-8 text-slate-800">Add a New Subject</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                 <label htmlFor="subject-name" className="sr-only">Subject Name</label>
                 <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                         <BookOpenIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        id="subject-name"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="Subject Name (e.g. Biology)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-sm"
                        required
                    />
                 </div>
            </div>

            <label
              htmlFor="file-upload"
              className="relative cursor-pointer bg-slate-50 hover:bg-white border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-8 transition-all duration-300 block group"
            >
              <div className="flex flex-col items-center">
                <div className="bg-white p-3 rounded-full border border-slate-200 mb-4 group-hover:scale-110 transition-transform shadow-sm">
                     <DocumentArrowUpIcon className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                </div>
                <span className="font-bold text-slate-600 text-lg">
                  {file ? file.name : 'Upload study material'}
                </span>
                <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                  PDF, Images, or Text (Max 10MB)
                </p>
              </div>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/webp, application/pdf, text/plain, .md"
              />
            </label>

            {error && <p className="text-sm font-bold text-red-500">{error}</p>}
            
            <button 
                type="submit"
                disabled={isProcessing || !file || !subjectName}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shadow-md active:translate-y-0.5"
            >
                {isProcessing ? 'Processing...' : 'Create Subject'}
            </button>
        </form>
      </div>
    </div>
  );
};

export default FileUpload;