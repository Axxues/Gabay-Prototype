import React from 'react';

interface CreateProjectPageProps {
  courseId: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}

export const CreateProjectPage: React.FC<CreateProjectPageProps> = ({
  onBack,
}) => {
  return (
    <div className="p-6">
      <button onClick={onBack}>Back</button>
      <h2>Create Project</h2>
    </div>
  );
};
