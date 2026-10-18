import React from 'react';
import { MapPin } from 'lucide-react';
import type { NormalizedAddress } from '../../../shared/types/lms';

interface NormalizedAddressFieldsProps {
  labelPrefix: string; // 'student' | 'faculty'
  permanentAddress: NormalizedAddress;
  onChangePermanentAddress: (patch: Partial<NormalizedAddress>) => void;
  sameAsPermanentAddress: boolean;
  onToggleSameAsPermanent: (checked: boolean) => void;
  presentAddress: NormalizedAddress;
  onChangePresentAddress: (patch: Partial<NormalizedAddress>) => void;
  disabled?: boolean;
}

export const NormalizedAddressFields: React.FC<NormalizedAddressFieldsProps> = ({
  labelPrefix,
  permanentAddress,
  onChangePermanentAddress,
  sameAsPermanentAddress,
  onToggleSameAsPermanent,
  presentAddress,
  onChangePresentAddress,
  disabled = false,
}) => {
  const effectivePresentAddress = sameAsPermanentAddress ? permanentAddress : presentAddress;

  return (
    <div className="space-y-5">
      <div className="flex items-center space-x-2 text-xs font-bold text-foreground uppercase tracking-wider">
        <MapPin className="w-4 h-4 text-primary" />
        <span>Address Details</span>
      </div>

      {/* Permanent Address */}
      <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-foreground">
            Permanent Address <span className="text-destructive">*</span>
          </h5>
          <span className="text-[11px] text-muted-foreground">Official permanent residence</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-perm-street`} className="block text-[11px] font-semibold text-muted-foreground">
              House No. / Street / Building <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-perm-street`}
              type="text"
              required
              aria-label="Permanent House/Street"
              disabled={disabled}
              value={permanentAddress.houseStreet}
              onChange={(e) => onChangePermanentAddress({ houseStreet: e.target.value })}
              placeholder="e.g. 123 Academic Blvd, Subd."
              className="w-full px-3 py-2 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-perm-barangay`} className="block text-[11px] font-semibold text-muted-foreground">
              Barangay <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-perm-barangay`}
              type="text"
              required
              aria-label="Permanent Barangay"
              disabled={disabled}
              value={permanentAddress.barangay}
              onChange={(e) => onChangePermanentAddress({ barangay: e.target.value })}
              placeholder="e.g. Catbangen"
              className="w-full px-3 py-2 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-perm-city`} className="block text-[11px] font-semibold text-muted-foreground">
              Municipality / City <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-perm-city`}
              type="text"
              required
              aria-label="Permanent Municipality/City"
              disabled={disabled}
              value={permanentAddress.municipalityCity}
              onChange={(e) => onChangePermanentAddress({ municipalityCity: e.target.value })}
              placeholder="e.g. San Fernando City"
              className="w-full px-3 py-2 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-perm-province`} className="block text-[11px] font-semibold text-muted-foreground">
              Province <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-perm-province`}
              type="text"
              required
              aria-label="Permanent Province"
              disabled={disabled}
              value={permanentAddress.province}
              onChange={(e) => onChangePermanentAddress({ province: e.target.value })}
              placeholder="e.g. La Union"
              className="w-full px-3 py-2 text-xs bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Same as Permanent Checkbox */}
      <div className="px-1">
        <label
          htmlFor={`${labelPrefix}-same-as-permanent`}
          className="inline-flex items-center space-x-2.5 cursor-pointer text-xs font-semibold text-foreground select-none"
        >
          <input
            type="checkbox"
            id={`${labelPrefix}-same-as-permanent`}
            aria-label="Present address is the same as permanent address"
            checked={sameAsPermanentAddress}
            disabled={disabled}
            onChange={(e) => onToggleSameAsPermanent(e.target.checked)}
            className="w-4 h-4 rounded-md border-border text-primary focus:ring-primary/30 accent-primary cursor-pointer"
          />
          <span>Present address is the same as permanent address</span>
        </label>
      </div>

      {/* Present Address */}
      <div className="p-4 bg-muted/20 border border-border rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-foreground">
            Present Address <span className="text-destructive">*</span>
          </h5>
          <span className="text-[11px] text-muted-foreground">
            {sameAsPermanentAddress ? 'Auto-filled from permanent address (Locked)' : 'Current residential address'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-pres-street`} className="block text-[11px] font-semibold text-muted-foreground">
              House No. / Street / Building <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-pres-street`}
              type="text"
              required
              aria-label="Present House/Street"
              disabled={disabled || sameAsPermanentAddress}
              value={effectivePresentAddress.houseStreet}
              onChange={(e) => onChangePresentAddress({ houseStreet: e.target.value })}
              placeholder="e.g. 456 Dormitory Row"
              className={`w-full px-3 py-2 text-xs border border-border rounded-xl font-sans outline-none transition-all ${
                sameAsPermanentAddress
                  ? 'bg-muted/40 text-muted-foreground cursor-not-allowed select-none'
                  : 'bg-background text-foreground focus:ring-2 focus:ring-primary/30'
              }`}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-pres-barangay`} className="block text-[11px] font-semibold text-muted-foreground">
              Barangay <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-pres-barangay`}
              type="text"
              required
              aria-label="Present Barangay"
              disabled={disabled || sameAsPermanentAddress}
              value={effectivePresentAddress.barangay}
              onChange={(e) => onChangePresentAddress({ barangay: e.target.value })}
              placeholder="e.g. Barangay 1"
              className={`w-full px-3 py-2 text-xs border border-border rounded-xl font-sans outline-none transition-all ${
                sameAsPermanentAddress
                  ? 'bg-muted/40 text-muted-foreground cursor-not-allowed select-none'
                  : 'bg-background text-foreground focus:ring-2 focus:ring-primary/30'
              }`}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-pres-city`} className="block text-[11px] font-semibold text-muted-foreground">
              Municipality / City <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-pres-city`}
              type="text"
              required
              aria-label="Present Municipality/City"
              disabled={disabled || sameAsPermanentAddress}
              value={effectivePresentAddress.municipalityCity}
              onChange={(e) => onChangePresentAddress({ municipalityCity: e.target.value })}
              placeholder="e.g. San Fernando City"
              className={`w-full px-3 py-2 text-xs border border-border rounded-xl font-sans outline-none transition-all ${
                sameAsPermanentAddress
                  ? 'bg-muted/40 text-muted-foreground cursor-not-allowed select-none'
                  : 'bg-background text-foreground focus:ring-2 focus:ring-primary/30'
              }`}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${labelPrefix}-pres-province`} className="block text-[11px] font-semibold text-muted-foreground">
              Province <span className="text-destructive">*</span>
            </label>
            <input
              id={`${labelPrefix}-pres-province`}
              type="text"
              required
              aria-label="Present Province"
              disabled={disabled || sameAsPermanentAddress}
              value={effectivePresentAddress.province}
              onChange={(e) => onChangePresentAddress({ province: e.target.value })}
              placeholder="e.g. La Union"
              className={`w-full px-3 py-2 text-xs border border-border rounded-xl font-sans outline-none transition-all ${
                sameAsPermanentAddress
                  ? 'bg-muted/40 text-muted-foreground cursor-not-allowed select-none'
                  : 'bg-background text-foreground focus:ring-2 focus:ring-primary/30'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
