import React from 'react';

interface CreateAssignmentPageProps {
  courseId: string;
  onBack: () => void;
  onCreated: (id: string) => void;
}

export const CreateAssignmentPage: React.FC<CreateAssignmentPageProps> = ({
  onBack,
}) => {
  return (
    <div className="p-6">
      <button onClick={onBack}>Back</button>
      <h2>Create Assignment</h2>
    </div>
  );
};
