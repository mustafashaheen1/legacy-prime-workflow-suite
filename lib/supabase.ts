import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helper functions
export const auth = {
  /**
   * Sign up a new company account
   */
  signUpCompany: async (params: {
    email: string;
    password: string;
    name: string;
    companyName: string;
    employeeCount: number;
    subscriptionPlan: 'basic' | 'pro' | 'enterprise';
  }) => {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            name: params.name,
            role: 'admin',
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from signup');

      // 2. Generate unique company code
      const companyCode = generateCompanyCode();

      // 3. Create company record
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: params.companyName,
          subscription_plan: params.subscriptionPlan,
          subscription_status: 'trial',
          employee_count: params.employeeCount,
          company_code: companyCode,
          settings: {
            features: {
              crm: true,
              estimates: true,
              schedule: true,
              expenses: true,
              photos: true,
              chat: true,
              reports: true,
              clock: true,
              dashboard: true,
            },
            maxUsers: params.subscriptionPlan === 'basic' ? 10 : params.subscriptionPlan === 'pro' ? 25 : 100,
            maxProjects: params.subscriptionPlan === 'basic' ? 50 : params.subscriptionPlan === 'pro' ? 200 : 1000,
          },
        })
        .select()
        .single();

      if (companyError) {
        // Cleanup: delete auth user if company creation fails
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw companyError;
      }

      // 4. Create user profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: params.email,
          name: params.name,
          role: 'admin',
          company_id: company.id,
          is_active: true,
        })
        .select()
        .single();

      if (userError) {
        // Cleanup: delete company and auth user
        await supabase.from('companies').delete().eq('id', company.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw userError;
      }

      return {
        success: true,
        user,
        company,
        companyCode,
        session: authData.session,
      };
    } catch (error: any) {
      console.error('[Auth] Company signup error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create company account',
      };
    }
  },

  /**
   * Sign up a new employee account
   */
  signUpEmployee: async (params: {
    email: string;
    password: string;
    name: string;
    companyCode: string;
    phone?: string;
    address?: string;
  }) => {
    try {
      // 1. Validate company code
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('company_code', params.companyCode)
        .single();

      if (companyError || !company) {
        return {
          success: false,
          error: 'Invalid company code. Please check with your employer.',
        };
      }

      // 2. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            name: params.name,
            role: 'employee',
            company_id: company.id,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from signup');

      // 3. Create user profile (pending approval)
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: params.email,
          name: params.name,
          role: 'employee',
          company_id: company.id,
          phone: params.phone,
          address: params.address,
          is_active: false, // Admin must approve
        })
        .select()
        .single();

      if (userError) {
        // Cleanup: delete auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw userError;
      }

      return {
        success: true,
        user,
        company,
        session: authData.session,
        pendingApproval: true,
      };
    } catch (error: any) {
      console.error('[Auth] Employee signup error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create employee account',
      };
    }
  },

  /**
   * Sign in existing user
   */
  signIn: async (email: string, password: string) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Get user profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw userError;

      // Check if user is active
      if (!user.is_active) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'Your account is pending approval from your administrator.',
        };
      }

      return {
        success: true,
        user,
        session: authData.session,
      };
    } catch (error: any) {
      console.error('[Auth] Sign in error:', error);
      return {
        success: false,
        error: error.message || 'Invalid email or password',
      };
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('[Auth] Sign out error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Get current session
   */
  getSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Get current user with profile
   */
  getCurrentUser: async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;

      const { data: user } = await supabase
        .from('users')
        .select('*, companies(*)')
        .eq('id', authUser.id)
        .single();

      return user;
    } catch (error) {
      console.error('[Auth] Get current user error:', error);
      return null;
    }
  },

  /**
   * Reset password
   */
  resetPassword: async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'exp://localhost:8081/(auth)/reset-password',
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.',
      };
    } catch (error: any) {
      console.error('[Auth] Reset password error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

// Helper function to generate unique company code
function generateCompanyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
