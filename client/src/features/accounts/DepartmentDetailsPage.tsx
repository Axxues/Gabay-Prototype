import React from 'react';

interface DepartmentDetailsPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const DepartmentDetailsPage: React.FC<DepartmentDetailsPageProps> = () => {
  return (
    <div data-testid="department-details-page">
      Department Details
    </div>
  );
};
