import React from 'react';
import MagicEditor from '@/components/MagicEditor';
import templates from '@/config/templates.json'; // Ensure this file exists
import { notFound } from 'next/navigation';

export default function CreatePage({ params }: { params: { id: string } }) {
  // Validate that the requested template actually exists in our config
  const template = templates.find((t) => t.id === params.id);
  if (!template) notFound();

  // MVP: Generate a temporary guest ID. 
  // In V2, this will be replaced by Supabase Auth (User ID)
  const tempUserId = "guest_" + Math.floor(Math.random() * 99999);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <a href="/" className="text-gray-500 hover:text-emerald-600 font-bold transition-colors">← Back</a>
        <span className="font-bold text-emerald-800">MyGiggleGram 🎄</span>
      </div>

      <div className="w-full max-w-md mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{template.name}</h1>
        <p className="text-gray-500">{template.description}</p>
      </div>

      <div className="w-full max-w-md">
        <MagicEditor templateId={template.id} userId={tempUserId} />
      </div>
      
      <div className="mt-8 text-center text-xs text-gray-400 max-w-xs">
        <p>🔒 Photos are deleted automatically after 60 seconds.</p>
      </div>
    </div>
  );
}