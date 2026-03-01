export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      inspection_videos: {
        Row: {
          id: string
          token: string
          client_id: string
          company_id: string
          project_id: string | null
          client_name: string
          client_email: string | null
          status: 'pending' | 'completed'
          video_url: string | null
          video_duration: number | null
          video_size: number | null
          notes: string | null
          created_at: string
          completed_at: string | null
          expires_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          token: string
          client_id: string
          company_id: string
          project_id?: string | null
          client_name: string
          client_email?: string | null
          status?: 'pending' | 'completed'
          video_url?: string | null
          video_duration?: number | null
          video_size?: number | null
          notes?: string | null
          created_at?: string
          completed_at?: string | null
          expires_at: string
          updated_at?: string
        }
        Update: {
          id?: string
          token?: string
          client_id?: string
          company_id?: string
          project_id?: string | null
          client_name?: string
          client_email?: string | null
          status?: 'pending' | 'completed'
          video_url?: string | null
          video_duration?: number | null
          video_size?: number | null
          notes?: string | null
          created_at?: string
          completed_at?: string | null
          expires_at?: string
          updated_at?: string
        }
      }
      clients: {
        Row: {
          id: string
          company_id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          source: string | null
          status: string | null
          last_contacted: string | null
          last_contact_date: string | null
          next_follow_up_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          source?: string | null
          status?: string | null
          last_contacted?: string | null
          last_contact_date?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          source?: string | null
          status?: string | null
          last_contacted?: string | null
          last_contact_date?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      call_logs: {
        Row: {
          id: string
          company_id: string
          call_sid: string | null
          from_number: string | null
          to_number: string | null
          direction: string | null
          status: string | null
          lead_qualified: boolean | null
          lead_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          call_sid?: string | null
          from_number?: string | null
          to_number?: string | null
          direction?: string | null
          status?: string | null
          lead_qualified?: boolean | null
          lead_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          call_sid?: string | null
          from_number?: string | null
          to_number?: string | null
          direction?: string | null
          status?: string | null
          lead_qualified?: boolean | null
          lead_data?: Json | null
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
      }
      tasks: {
        Row: {
          id: string
          company_id: string
          project_id: string | null
          name: string
          date: string | null
          reminder: string | null
          completed: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          project_id?: string | null
          name: string
          date?: string | null
          reminder?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          project_id?: string | null
          name?: string
          date?: string | null
          reminder?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      photo_categories: {
        Row: {
          id: string
          company_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          company_id: string
          type: 'payment-received' | 'estimate-received' | 'proposal-submitted' | 'change-order' | 'general' | 'task-reminder'
          title: string
          message: string
          data: Json | null
          read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          type: 'payment-received' | 'estimate-received' | 'proposal-submitted' | 'change-order' | 'general' | 'task-reminder'
          title: string
          message: string
          data?: Json | null
          read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          type?: 'payment-received' | 'estimate-received' | 'proposal-submitted' | 'change-order' | 'general' | 'task-reminder'
          title?: string
          message?: string
          data?: Json | null
          read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          is_active: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          company_id: string
          email: string
          name: string
          role: string
          is_active: boolean
          avatar: string | null
          phone: string | null
          address: string | null
          hourly_rate: number | null
          custom_permissions: Json | null
          rate_change_request: Json | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          company_id: string
          email: string
          name: string
          role: string
          is_active?: boolean
          avatar?: string | null
          phone?: string | null
          address?: string | null
          hourly_rate?: number | null
          custom_permissions?: Json | null
          rate_change_request?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          email?: string
          name?: string
          role?: string
          is_active?: boolean
          avatar?: string | null
          phone?: string | null
          address?: string | null
          hourly_rate?: number | null
          custom_permissions?: Json | null
          rate_change_request?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
