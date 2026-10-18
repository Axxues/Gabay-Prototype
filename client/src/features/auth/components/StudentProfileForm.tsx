import React, { useState } from 'react';
import { Save, AlertCircle, Info, Calendar, Phone, Users, CheckCircle2 } from 'lucide-react';
import type { User, NormalizedPersonName, NormalizedAddress } from '../../../shared/types/lms';
import { getMaxBirthdayDate, isValidBirthday, parseAddress, formatAddress, isAddressComplete } from '../../../shared/utils/profileCompletion';
import { NormalizedAddressFields } from './NormalizedAddressFields';

interface StudentProfileFormProps {
  user: User;
  updateUser: (userId: string, updates: Partial<User>) => Promise<boolean>;
  showAlert?: (options: { title: string; message: string; type?: 'info' | 'success' | 'warning' | 'error' }) => void;
  onSuccess?: () => void;
}

export const StudentProfileForm: React.FC<StudentProfileFormProps> = ({
  user,
  updateUser,
  showAlert,
  onSuccess,
}) => {
  const initialSameAs = user.sameAsPermanentAddress ?? (
    Boolean(user.permanentAddress && user.presentAddress && user.permanentAddress === user.presentAddress)
  );

  const [birthday, setBirthday] = useState(user.birthday || '');
  const [permanentAddressDetails, setPermanentAddressDetails] = useState<NormalizedAddress>(
    user.permanentAddressDetails || parseAddress(user.permanentAddress)
  );
  const [sameAsPermanentAddress, setSameAsPermanentAddress] = useState(initialSameAs);
  const [presentAddressDetails, setPresentAddressDetails] = useState<NormalizedAddress>(
    initialSameAs
      ? (user.permanentAddressDetails || parseAddress(user.permanentAddress))
      : (user.presentAddressDetails || parseAddress(user.presentAddress))
  );
  const [contactNumber, setContactNumber] = useState(user.contactNumber || '');
  const [hasGuardianOnly, setHasGuardianOnly] = useState(user.hasGuardianOnly || false);

  const [motherName, setMotherName] = useState<NormalizedPersonName>({
    firstName: user.motherName?.firstName || '',
    middleName: user.motherName?.middleName || '',
    lastName: user.motherName?.lastName || '',
  });

  const [fatherName, setFatherName] = useState<NormalizedPersonName>({
    firstName: user.fatherName?.firstName || '',
    middleName: user.fatherName?.middleName || '',
    lastName: user.fatherName?.lastName || '',
  });

  const [guardianName, setGuardianName] = useState<NormalizedPersonName>({
    firstName: user.guardianName?.firstName || '',
    middleName: user.guardianName?.middleName || '',
    lastName: user.guardianName?.lastName || '',
  });

  const [parentContactNumber, setParentContactNumber] = useState(user.parentContactNumber || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const yearLevel = user.yearLevel || 1;
  const maxBirthdayDate = getMaxBirthdayDate();

  const handlePermanentAddressChange = (patch: Partial<NormalizedAddress>) => {
    setPermanentAddressDetails(prev => {
      const updated = { ...prev, ...patch };
      if (sameAsPermanentAddress) {
        setPresentAddressDetails(updated);
      }
      return updated;
    });
  };

  const handleSameAsPermanentToggle = (checked: boolean) => {
    setSameAsPermanentAddress(checked);
    if (checked) {
      setPresentAddressDetails(permanentAddressDetails);
    }
  };

  const handlePresentAddressChange = (patch: Partial<NormalizedAddress>) => {
    setPresentAddressDetails(prev => ({ ...prev, ...patch }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isValidBirthday(birthday)) {
      setErrorMessage('Birthday must be from a previous date and cannot be in the future (such as tomorrow or later).');
      return;
    }

    const effectivePresentDetails = sameAsPermanentAddress ? permanentAddressDetails : presentAddressDetails;

    if (!isAddressComplete(permanentAddressDetails)) {
      setErrorMessage('Please fill in all permanent address details (House/Street, Barangay, Municipality/City, Province).');
      return;
    }

    if (!isAddressComplete(effectivePresentDetails)) {
      setErrorMessage('Please fill in all present address details (House/Street, Barangay, Municipality/City, Province).');
      return;
    }

    setIsSaving(true);

    const formattedPermanent = formatAddress(permanentAddressDetails);
    const formattedPresent = formatAddress(effectivePresentDetails);

    const updates: Partial<User> = {
      birthday,
      permanentAddress: formattedPermanent,
      presentAddress: formattedPresent,
      permanentAddressDetails,
      presentAddressDetails: effectivePresentDetails,
      sameAsPermanentAddress,
      contactNumber,
      hasGuardianOnly,
      motherName,
      fatherName,
      guardianName,
      parentContactNumber,
      yearLevel: user.yearLevel ?? 1,
    };

    try {
      const ok = await updateUser(user.id, updates);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (showAlert) {
          showAlert({
            title: 'Profile Updated',
            message: 'Your student institutional record has been saved successfully.',
            type: 'success',
          });
        }
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setErrorMessage('Failed to save profile changes. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-2 text-xs font-sans font-bold text-emerald-700 dark:text-emerald-400 animate-fade-in shadow-soft">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Student profile information updated and saved successfully!</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl flex items-center space-x-2 text-xs font-sans font-bold text-destructive animate-fade-in shadow-soft">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Year Level & Academic Status */}
      <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label htmlFor="student-year-level" className="block text-xs font-bold text-foreground">
              Year Level
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Year level is managed by your Program Chair or Dean and auto-increments each school year.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="student-year-level"
              type="text"
              readOnly
              disabled
              value={`Year ${yearLevel}`}
              aria-label="Year Level"
              className="w-24 px-3 py-1.5 text-xs font-bold text-center bg-muted border border-border rounded-xl text-foreground cursor-not-allowed select-none"
            />
            <span className="px-2.5 py-1 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 rounded-full inline-flex items-center gap-1">
              <Info className="w-3 h-3" />
              Locked
            </span>
          </div>
        </div>
      </div>

      {/* Basic Demographics */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Demographics & Contact
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="student-birthday" className="block text-xs font-bold text-muted-foreground mb-1">
              Birthday <span className="text-destructive">*</span>
            </label>
            <input
              id="student-birthday"
              type="date"
              required
              aria-label="Birthday"
              value={birthday}
              max={maxBirthdayDate}
              onChange={(e) => {
                setBirthday(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3.5 py-2 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans outline-none"
            />
            {birthday && !isValidBirthday(birthday) && (
              <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Birthday must be from a previous date and cannot be in the future.</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="student-contact" className="block text-xs font-bold text-muted-foreground mb-1">
              Contact Number <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-3" />
              <input
                id="student-contact"
                type="tel"
                required
                aria-label="Contact Number"
                placeholder="09XXXXXXXXX"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Address Details */}
      <NormalizedAddressFields
        labelPrefix="student"
        permanentAddress={permanentAddressDetails}
        onChangePermanentAddress={handlePermanentAddressChange}
        sameAsPermanentAddress={sameAsPermanentAddress}
        onToggleSameAsPermanent={handleSameAsPermanentToggle}
        presentAddress={presentAddressDetails}
        onChangePresentAddress={handlePresentAddressChange}
        disabled={isSaving}
      />

      {/* Family Information */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Family Information
          </h4>
          <div className="flex items-center space-x-4">
            <label className="inline-flex items-center space-x-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="radio"
                name="familyType"
                checked={!hasGuardianOnly}
                onChange={() => setHasGuardianOnly(false)}
                aria-label="Parents (Mother & Father)"
                className="w-3.5 h-3.5 text-primary border-border focus:ring-primary/30 cursor-pointer"
              />
              <span>Parents (Mother & Father)</span>
            </label>
            <label className="inline-flex items-center space-x-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="radio"
                name="familyType"
                checked={hasGuardianOnly}
                onChange={() => setHasGuardianOnly(true)}
                aria-label="Guardian"
                className="w-3.5 h-3.5 text-primary border-border focus:ring-primary/30 cursor-pointer"
              />
              <span>Guardian</span>
            </label>
          </div>
        </div>

        {!hasGuardianOnly ? (
          <div className="space-y-4">
            {/* Mother's Details */}
            <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
              <span className="text-xs font-bold text-foreground">Mother's Information</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="mother-first-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                    First Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="mother-first-name"
                    type="text"
                    required
                    aria-label="Mother's First Name"
                    value={motherName.firstName}
                    onChange={(e) => setMotherName({ ...motherName, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="mother-middle-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                    Middle Name <span className="text-[10px] font-normal text-muted-foreground">(Optional)</span>
                  </label>
                  <input
                    id="mother-middle-name"
                    type="text"
                    aria-label="Mother's Middle Name"
                    value={motherName.middleName || ''}
                    onChange={(e) => setMotherName({ ...motherName, middleName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="mother-last-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                    Last Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="mother-last-name"
                    type="text"
                    required
                    aria-label="Mother's Last Name"
                    value={motherName.lastName}
                    onChange={(e) => setMotherName({ ...motherName, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Father's Details */}
            <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
              <span className="text-xs font-bold text-foreground">Father's Information</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="father-first-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                    First Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="father-first-name"
                    type="text"
                    required
                    aria-label="Father's First Name"
                    value={fatherName.firstName}
                    onChange={(e) => setFatherName({ ...fatherName, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="father-middle-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                    Middle Name <span className="text-[10px] font-normal text-muted-foreground">(Optional)</span>
                  </label>
                  <input
                    id="father-middle-name"
                    type="text"
                    aria-label="Father's Middle Name"
                    value={fatherName.middleName || ''}
                    onChange={(e) => setFatherName({ ...fatherName, middleName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="father-last-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                    Last Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="father-last-name"
                    type="text"
                    required
                    aria-label="Father's Last Name"
                    value={fatherName.lastName}
                    onChange={(e) => setFatherName({ ...fatherName, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Guardian's Details */
          <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
            <span className="text-xs font-bold text-foreground">Guardian's Information</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="guardian-first-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="guardian-first-name"
                  type="text"
                  required
                  aria-label="Guardian's First Name"
                  value={guardianName.firstName}
                  onChange={(e) => setGuardianName({ ...guardianName, firstName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                />
              </div>
              <div>
                <label htmlFor="guardian-middle-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                  Middle Name <span className="text-[10px] font-normal text-muted-foreground">(Optional)</span>
                </label>
                <input
                  id="guardian-middle-name"
                  type="text"
                  aria-label="Guardian's Middle Name"
                  value={guardianName.middleName || ''}
                  onChange={(e) => setGuardianName({ ...guardianName, middleName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                />
              </div>
              <div>
                <label htmlFor="guardian-last-name" className="block text-[11px] font-bold text-muted-foreground mb-1">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="guardian-last-name"
                  type="text"
                  required
                  aria-label="Guardian's Last Name"
                  value={guardianName.lastName}
                  onChange={(e) => setGuardianName({ ...guardianName, lastName: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Parent / Guardian Contact Number */}
        <div>
          <label htmlFor="parent-guardian-contact" className="block text-xs font-bold text-muted-foreground mb-1">
            Parent / Guardian Contact Number <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3.5 top-3" />
            <input
              id="parent-guardian-contact"
              type="tel"
              required
              aria-label="Parent / Guardian Contact Number"
              placeholder="09XXXXXXXXX"
              value={parentContactNumber}
              onChange={(e) => setParentContactNumber(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans outline-none"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-none flex items-center space-x-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </div>
    </form>
  );
};
