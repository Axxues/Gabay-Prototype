import React, { useState } from 'react';
import { Save, AlertCircle, Calendar, Phone, Briefcase, GraduationCap, Plus, Trash2, CheckCircle2, Award } from 'lucide-react';
import type { User, EducationalDegree, DegreeLevel, NormalizedAddress } from '../../../shared/types/lms';
import { getMaxBirthdayDate, isValidBirthday, parseAddress, formatAddress, isAddressComplete, isDegreeComplete } from '../../../shared/utils/profileCompletion';
import { NormalizedAddressFields } from './NormalizedAddressFields';

interface FacultyProfileFormProps {
  user: User;
  updateUser: (userId: string, updates: Partial<User>) => Promise<boolean>;
  showAlert?: (options: { title: string; message: string; type?: 'info' | 'success' | 'warning' | 'error' }) => void;
  onSuccess?: () => void;
}

const DEGREE_OPTIONS: { value: DegreeLevel; label: string }[] = [
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'post_masters', label: "Post-Master's" },
  { value: 'doctorate', label: 'Doctorate / Ph.D.' },
  { value: 'post_doctorate', label: 'Post-Doctorate' },
];

export const FacultyProfileForm: React.FC<FacultyProfileFormProps> = ({
  user,
  updateUser,
  showAlert,
  onSuccess,
}) => {
  const initialSameAs = user.sameAsPermanentAddress ?? (
    Boolean(user.permanentAddress && user.presentAddress && user.permanentAddress === user.presentAddress)
  );

  const [permanentAddressDetails, setPermanentAddressDetails] = useState<NormalizedAddress>(
    user.permanentAddressDetails || parseAddress(user.permanentAddress || user.address)
  );
  const [sameAsPermanentAddress, setSameAsPermanentAddress] = useState(initialSameAs);
  const [presentAddressDetails, setPresentAddressDetails] = useState<NormalizedAddress>(
    initialSameAs
      ? (user.permanentAddressDetails || parseAddress(user.permanentAddress || user.address))
      : (user.presentAddressDetails || parseAddress(user.presentAddress || user.address))
  );

  const [contactNumber, setContactNumber] = useState(user.contactNumber || '');
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [yearsOfTeaching, setYearsOfTeaching] = useState<number | string>(user.yearsOfTeaching ?? 0);

  const [educationalBackground, setEducationalBackground] = useState<EducationalDegree[]>(
    user.educationalBackground && user.educationalBackground.length > 0
      ? user.educationalBackground
      : []
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleAddDegree = () => {
    const newDegree: EducationalDegree = {
      id: `deg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      degreeLevel: '',
      school: '',
      yearGraduated: '',
      specialization: '',
    };
    setEducationalBackground(prev => [...prev, newDegree]);
  };

  const handleRemoveDegree = (id: string) => {
    setEducationalBackground(prev => prev.filter(deg => deg.id !== id));
  };

  const handleUpdateDegree = (id: string, field: keyof EducationalDegree, value: any) => {
    setEducationalBackground(prev =>
      prev.map(deg => (deg.id === id ? { ...deg, [field]: value } : deg))
    );
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
      setErrorMessage('Please fill in all required permanent address details (Barangay, Municipality/City, Province).');
      return;
    }

    if (!isAddressComplete(effectivePresentDetails)) {
      setErrorMessage('Please fill in all required present address details (Barangay, Municipality/City, Province).');
      return;
    }

    const invalidDegree = educationalBackground.find(deg => !deg.degreeLevel || !isDegreeComplete(deg));
    if (educationalBackground.length > 0 && invalidDegree) {
      if (!invalidDegree.degreeLevel) {
        setErrorMessage('Please select a degree level for all educational degree entries.');
        return;
      }
      setErrorMessage('Please fill in all degree details (School, Year Graduated, Field of Specialization).');
      return;
    }

    setIsSaving(true);

    const parsedYears = typeof yearsOfTeaching === 'string' ? (parseInt(yearsOfTeaching, 10) || 0) : yearsOfTeaching;
    const formattedPermanent = formatAddress(permanentAddressDetails);
    const formattedPresent = formatAddress(effectivePresentDetails);

    const updates: Partial<User> = {
      address: formattedPermanent,
      addressDetails: permanentAddressDetails,
      permanentAddress: formattedPermanent,
      presentAddress: formattedPresent,
      permanentAddressDetails,
      presentAddressDetails: effectivePresentDetails,
      sameAsPermanentAddress,
      contactNumber,
      birthday,
      yearsOfTeaching: parsedYears,
      educationalBackground,
    };

    try {
      const ok = await updateUser(user.id, updates);
      if (ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (showAlert) {
          showAlert({
            title: 'Profile Updated',
            message: 'Your faculty/staff profile has been updated successfully.',
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
          <span>Faculty profile information updated and saved successfully!</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-2xl flex items-center space-x-2 text-xs font-sans font-bold text-destructive animate-fade-in shadow-soft">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Teaching Experience & Auto-increment Info */}
      <div className="p-4 bg-muted/30 border border-border rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label htmlFor="faculty-years-teaching" className="block text-xs font-bold text-foreground">
              Years of Teaching Experience
            </label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cumulative teaching experience in academic institutions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 shrink-0">
              <Award className="w-3 h-3" />
              <span>Auto-increments by 1 on each academic year rollover</span>
            </span>
          </div>
        </div>

        <div className="w-full sm:w-48">
          <input
            id="faculty-years-teaching"
            type="number"
            min={0}
            max={70}
            value={yearsOfTeaching}
            onChange={e => setYearsOfTeaching(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground font-sans outline-none transition-all"
            placeholder="0"
            aria-label="Years of Teaching Experience"
          />
        </div>
      </div>

      {/* Contact & Personal Information */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider">
          <Briefcase className="w-4 h-4 text-primary" />
          <span>Personal & Contact Information</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="faculty-birthday" className="flex items-center space-x-1.5 text-xs font-semibold text-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Birthday</span>
            </label>
            <input
              id="faculty-birthday"
              type="date"
              required
              aria-label="Birthday"
              value={birthday}
              max={maxBirthdayDate}
              onChange={e => {
                setBirthday(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3.5 py-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground font-sans outline-none transition-all"
            />
            {birthday && !isValidBirthday(birthday) && (
              <p className="text-[11px] font-semibold text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Birthday must be from a previous date and cannot be in the future.</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="faculty-contact" className="flex items-center space-x-1.5 text-xs font-semibold text-foreground">
              <Phone className="w-3.5 h-3.5 text-primary" />
              <span>Contact Number</span>
            </label>
            <input
              id="faculty-contact"
              type="tel"
              value={contactNumber}
              onChange={e => setContactNumber(e.target.value)}
              placeholder="e.g. 09123456789"
              className="w-full px-3.5 py-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground font-sans outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Address Details */}
      <NormalizedAddressFields
        labelPrefix="faculty"
        permanentAddress={permanentAddressDetails}
        onChangePermanentAddress={handlePermanentAddressChange}
        sameAsPermanentAddress={sameAsPermanentAddress}
        onToggleSameAsPermanent={handleSameAsPermanentToggle}
        presentAddress={presentAddressDetails}
        onChangePresentAddress={handlePresentAddressChange}
        disabled={isSaving}
      />

      {/* Educational Background */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span>Educational Background</span>
          </div>
          <button
            type="button"
            onClick={handleAddDegree}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Degree</span>
          </button>
        </div>

        {educationalBackground.length === 0 ? (
          <div className="p-6 bg-muted/20 border border-dashed border-border rounded-2xl text-center space-y-2">
            <p className="text-xs text-muted-foreground">No educational degrees recorded yet.</p>
            <button
              type="button"
              onClick={handleAddDegree}
              className="inline-flex items-center space-x-1 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add your bachelor's, master's, or doctorate degree</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {educationalBackground.map((degree, index) => (
              <div
                key={degree.id || index}
                className="p-4 bg-muted/20 border border-border rounded-2xl space-y-3 relative group"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <span className="text-xs font-bold text-foreground">
                    Degree #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDegree(degree.id)}
                    aria-label={`Remove degree ${index + 1}`}
                    className="inline-flex items-center space-x-1 text-xs text-destructive hover:text-destructive/80 font-semibold p-1 hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor={`degree-level-${degree.id}`}
                      className="block text-[11px] font-semibold text-muted-foreground"
                    >
                      Degree Level
                    </label>
                    <select
                      id={`degree-level-${degree.id}`}
                      value={degree.degreeLevel || ''}
                      aria-label="Degree Level"
                      onChange={e =>
                        handleUpdateDegree(degree.id, 'degreeLevel', e.target.value as DegreeLevel)
                      }
                      className="w-full px-3 py-2 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground font-sans outline-none"
                    >
                      <option value="">Select Degree</option>
                      {DEGREE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`degree-year-${degree.id}`}
                      className="block text-[11px] font-semibold text-muted-foreground"
                    >
                      Year Graduated
                    </label>
                    <input
                      id={`degree-year-${degree.id}`}
                      type="text"
                      aria-label="Year Graduated"
                      value={degree.yearGraduated}
                      onChange={e => handleUpdateDegree(degree.id, 'yearGraduated', e.target.value)}
                      placeholder="e.g. 2020"
                      className="w-full px-3 py-2 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground font-sans outline-none"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor={`degree-school-${degree.id}`}
                      className="block text-[11px] font-semibold text-muted-foreground"
                    >
                      School / Institution
                    </label>
                    <input
                      id={`degree-school-${degree.id}`}
                      type="text"
                      aria-label="School / Institution"
                      value={degree.school}
                      onChange={e => handleUpdateDegree(degree.id, 'school', e.target.value)}
                      placeholder="e.g. Don Mariano Marcos Memorial State University"
                      className="w-full px-3 py-2 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground font-sans outline-none"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label
                      htmlFor={`degree-spec-${degree.id}`}
                      className="block text-[11px] font-semibold text-muted-foreground"
                    >
                      Field of Specialization
                    </label>
                    <input
                      id={`degree-spec-${degree.id}`}
                      type="text"
                      aria-label="Field of Specialization"
                      value={degree.specialization}
                      onChange={e => handleUpdateDegree(degree.id, 'specialization', e.target.value)}
                      placeholder="e.g. BS in Information Technology, MS in Software Engineering"
                      className="w-full px-3 py-2 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-xs text-foreground font-sans outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-soft flex items-center space-x-2 cursor-pointer disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </div>
    </form>
  );
};
