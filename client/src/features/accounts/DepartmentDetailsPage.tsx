import React from 'react';
import { ProgramDetailsPage, type ProgramDetailsPageProps } from './ProgramDetailsPage';

export type DepartmentDetailsPageProps = ProgramDetailsPageProps;
export const DepartmentDetailsPage: React.FC<DepartmentDetailsPageProps> = (props) => {
  return <ProgramDetailsPage {...props} />;
};

export default DepartmentDetailsPage;
