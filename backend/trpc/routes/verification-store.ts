interface VerificationData {
  code: string;
  phoneNumber: string;
  expiresAt: string;
  attempts: number;
}

class VerificationStore {
  private store: Map<string, VerificationData> = new Map();

  set(key: string, value: VerificationData): void {
    this.store.set(key, value);
  }

  get(key: string): VerificationData | undefined {
    return this.store.get(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

export const verificationStore = new VerificationStore();
