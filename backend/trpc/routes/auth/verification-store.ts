export type VerificationData = {
  code: string;
  phoneNumber: string;
  expiresAt: string;
  attempts: number;
};

export const verificationStore = new Map<string, VerificationData>();
