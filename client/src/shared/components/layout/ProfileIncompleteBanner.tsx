import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { isProfileComplete } from '../../utils/profileCompletion';

export interface ProfileIncompleteBannerProps {
  onNavigateTab?: (tab: string) => void;
}

export const ProfileIncompleteBanner: React.FC<ProfileIncompleteBannerProps> = ({
  onNavigateTab,
}) => {
  const { activeUser } = useLMS();
  const navigate = useNavigate();

  if (!activeUser || isProfileComplete(activeUser)) {
    return null;
  }

  const handleCompleteProfile = () => {
    if (onNavigateTab) {
      onNavigateTab('profile');
    }
    navigate('/profile');
  };

  return (
    <div
      role="alert"
      className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 transition-colors z-20 shrink-0"
    >
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-medium truncate sm:whitespace-normal">
            Your institutional profile is incomplete. Please finish setting up your profile details.
          </span>
        </div>
        <button
          type="button"
          onClick={handleCompleteProfile}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm transition-colors cursor-pointer shrink-0"
        >
          <span>Complete Profile</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
