import React from 'react';

interface CreatePresentationPageProps {
  courseId: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}

export const CreatePresentationPage: React.FC<CreatePresentationPageProps> = ({
  onBack,
}) => {
  return (
    <div className="p-6">
      <button onClick={onBack}>Back</button>
      <h2>Create Presentation</h2>
    </div>
  );
};
