// Supabase Database TypesThis is a minimal type definition. For full type safety, generate types with:
// npx supabase gen types typescript --project-id qwzhaexlnlfovrwzamop > types/supabase.ts

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          logo: string | null;
          brand_color: string;
          license_number: string | null;
          office_phone: string | null;
          cell_phone: string | null;
          address: string | null;
          email: string | null;
          website: string | null;
          slogan: string | null;
          estimate_template: string | null;
          subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled';
          subscription_plan: 'basic' | 'pro' | 'enterprise';
          subscription_start_date: string;
          subscription_end_date: string | null;
          employee_count: number;
          company_code: string | null;
          stripe_payment_intent_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          settings: any;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['companies']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'super-admin' | 'admin' | 'salesperson' | 'field-employee' | 'employee';
          company_id: string | null;
          avatar: string | null;
          phone: string | null;
          address: string | null;
          hourly_rate: number | null;
          rate_change_request: any | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      // Add other tables as needed
    };
  };
};
