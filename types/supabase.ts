// Supabase Database Types
// Auto-generated from database schema

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
      projects: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          budget: number;
          expenses: number;
          progress: number;
          status: 'active' | 'completed' | 'on-hold' | 'archived';
          image: string | null;
          hours_worked: number;
          start_date: string;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      clients: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          address: string | null;
          email: string;
          phone: string;
          source: string | null;
          status: string;
          last_contacted: string | null;
          last_contact_date: string | null;
          next_follow_up_date: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          company_id: string;
          project_id: string;
          type: string;
          subcategory: string;
          amount: number;
          store: string;
          date: string;
          receipt_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      photos: {
        Row: {
          id: string;
          company_id: string;
          project_id: string;
          category: string;
          notes: string | null;
          url: string;
          date: string;
          file_size: number | null;
          file_type: string | null;
          s3_key: string | null;
          compressed: boolean | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['photos']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['photos']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          company_id: string;
          project_id: string;
          name: string;
          date: string | null;
          reminder: string | null;
          completed: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      clock_entries: {
        Row: {
          id: string;
          company_id: string;
          employee_id: string;
          project_id: string;
          clock_in: string;
          clock_out: string | null;
          location: any;
          work_performed: string | null;
          category: string | null;
          lunch_breaks: any | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clock_entries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['clock_entries']['Insert']>;
      };
      estimates: {
        Row: {
          id: string;
          company_id: string;
          project_id: string;
          name: string;
          subtotal: number;
          tax_rate: number;
          tax_amount: number;
          total: number;
          status: 'draft' | 'sent' | 'approved' | 'rejected';
          created_date: string;
        };
        Insert: Omit<Database['public']['Tables']['estimates']['Row'], 'id' | 'created_date'>;
        Update: Partial<Database['public']['Tables']['estimates']['Insert']>;
      };
      estimate_items: {
        Row: {
          id: string;
          estimate_id: string;
          price_list_item_id: string | null;
          quantity: number;
          unit_price: number;
          custom_price: number | null;
          total: number;
          budget: number | null;
          budget_unit_price: number | null;
          notes: string | null;
          custom_name: string | null;
          custom_unit: string | null;
          custom_category: string | null;
          is_separator: boolean;
          separator_label: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['estimate_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['estimate_items']['Insert']>;
      };
      call_logs: {
        Row: {
          id: string;
          company_id: string;
          client_id: string | null;
          call_sid: string | null;
          from_number: string | null;
          to_number: string | null;
          direction: string | null;
          status: string | null;
          lead_qualified: boolean | null;
          lead_data: any | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['call_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['call_logs']['Insert']>;
      };
      custom_price_list_items: {
        Row: {
          id: string;
          company_id: string;
          category: string;
          name: string;
          description: string | null;
          unit: string;
          unit_price: number;
          labor_cost: number | null;
          material_cost: number | null;
          is_custom: boolean | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['custom_price_list_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['custom_price_list_items']['Insert']>;
      };
      custom_categories: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['custom_categories']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['custom_categories']['Insert']>;
      };
    };
  };
};
