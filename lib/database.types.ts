// AUTO-GENERATED - do not edit by hand.
// Regenerate with: node scripts/gen-types.mjs

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          id: string
          created_at: string
          venue_id: string | null
          activity_type: string | null
          content: string | null
          logged_by: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          venue_id?: string | null
          activity_type?: string | null
          content?: string | null
          logged_by?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          venue_id?: string | null
          activity_type?: string | null
          content?: string | null
          logged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venue_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          id: string
          artist_id: string | null
          booking_id: string | null
          file_url: string
          file_name: string | null
          status: string | null
          uploaded_at: string | null
        }
        Insert: {
          id?: string
          artist_id?: string | null
          booking_id?: string | null
          file_url: string
          file_name?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          id?: string
          artist_id?: string | null
          booking_id?: string | null
          file_url?: string
          file_name?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreements_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_availability: {
        Row: {
          id: string
          artist_id: string
          date: string
          note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          artist_id: string
          date: string
          note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          artist_id?: string
          date?: string
          note?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_availability_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_documents: {
        Row: {
          id: string
          artist_id: string
          doc_type: string
          file_url: string
          file_name: string | null
          status: string | null
          uploaded_at: string | null
        }
        Insert: {
          id?: string
          artist_id: string
          doc_type: string
          file_url: string
          file_name?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Update: {
          id?: string
          artist_id?: string
          doc_type?: string
          file_url?: string
          file_name?: string | null
          status?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_documents_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_invites: {
        Row: {
          id: string
          email: string
          token: string
          full_name: string | null
          stage_name: string | null
          used: boolean | null
          created_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          email: string
          token: string
          full_name?: string | null
          stage_name?: string | null
          used?: boolean | null
          created_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          token?: string
          full_name?: string | null
          stage_name?: string | null
          used?: boolean | null
          created_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
        ]
      }
      artists: {
        Row: {
          id: string
          user_id: string | null
          stage_name: string
          genres: string[] | null
          bio: string | null
          photo_url: string | null
          min_fee: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          stage_name: string
          genres?: string[] | null
          bio?: string | null
          photo_url?: string | null
          min_fee?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          stage_name?: string
          genres?: string[] | null
          bio?: string | null
          photo_url?: string | null
          min_fee?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      available_gigs: {
        Row: {
          id: string
          venue_id: string | null
          genre: string | null
          fee: number | null
          notes: string | null
          status: string | null
          created_at: string | null
          starts_at: string | null
          ends_at: string | null
          title: string | null
          fee_venue: number | null
        }
        Insert: {
          id?: string
          venue_id?: string | null
          genre?: string | null
          fee?: number | null
          notes?: string | null
          status?: string | null
          created_at?: string | null
          starts_at?: string | null
          ends_at?: string | null
          title?: string | null
          fee_venue?: number | null
        }
        Update: {
          id?: string
          venue_id?: string | null
          genre?: string | null
          fee?: number | null
          notes?: string | null
          status?: string | null
          created_at?: string | null
          starts_at?: string | null
          ends_at?: string | null
          title?: string | null
          fee_venue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "available_gigs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          id: string
          venue_id: string | null
          artist_id: string | null
          event_name: string | null
          fee_venue: number | null
          fee_artist: number | null
          dress_code: string | null
          brag_status: string | null
          brief_text: string | null
          internal_notes: string | null
          brief_doc_url: string | null
          created_at: string | null
          starts_at: string | null
          ends_at: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          contact_number: string | null
        }
        Insert: {
          id?: string
          venue_id?: string | null
          artist_id?: string | null
          event_name?: string | null
          fee_venue?: number | null
          fee_artist?: number | null
          dress_code?: string | null
          brag_status?: string | null
          brief_text?: string | null
          internal_notes?: string | null
          brief_doc_url?: string | null
          created_at?: string | null
          starts_at?: string | null
          ends_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          contact_number?: string | null
        }
        Update: {
          id?: string
          venue_id?: string | null
          artist_id?: string | null
          event_name?: string | null
          fee_venue?: number | null
          fee_artist?: number | null
          dress_code?: string | null
          brag_status?: string | null
          brief_text?: string | null
          internal_notes?: string | null
          brief_doc_url?: string | null
          created_at?: string | null
          starts_at?: string | null
          ends_at?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          contact_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      gig_responses: {
        Row: {
          id: string
          gig_id: string | null
          artist_id: string | null
          response: string | null
          responded_at: string | null
        }
        Insert: {
          id?: string
          gig_id?: string | null
          artist_id?: string | null
          response?: string | null
          responded_at?: string | null
        }
        Update: {
          id?: string
          gig_id?: string | null
          artist_id?: string | null
          response?: string | null
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gig_responses_gig_id_fkey"
            columns: ["gig_id"]
            isOneToOne: false
            referencedRelation: "available_gigs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gig_responses_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          booking_id: string | null
          amount: number
          vat: number | null
          status: string | null
          due_date: string | null
          paid_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          booking_id?: string | null
          amount: number
          vat?: number | null
          status?: string | null
          due_date?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          booking_id?: string | null
          amount?: number
          vat?: number | null
          status?: string | null
          due_date?: string | null
          paid_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          type: string | null
          message: string | null
          booking_id: string | null
          read: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          type?: string | null
          message?: string | null
          booking_id?: string | null
          read?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          type?: string | null
          message?: string | null
          booking_id?: string | null
          read?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          role: string
          full_name: string | null
          email: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          role: string
          full_name?: string | null
          email?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          role?: string
          full_name?: string | null
          email?: string | null
          created_at?: string | null
        }
        Relationships: [
        ]
      }
      venue_documents: {
        Row: {
          id: string
          venue_id: string
          name: string
          file_url: string
          doc_type: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          name: string
          file_url: string
          doc_type?: string | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          name?: string
          file_url?: string
          doc_type?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_documents_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_pipeline: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          holding_company: string | null
          brand_name: string
          venue_type: string | null
          area: string | null
          priority: string | null
          contact_name: string | null
          contact_title: string | null
          linkedin_url: string | null
          email: string | null
          status: string
          date_contacted: string | null
          last_activity: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          assigned_to: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          holding_company?: string | null
          brand_name: string
          venue_type?: string | null
          area?: string | null
          priority?: string | null
          contact_name?: string | null
          contact_title?: string | null
          linkedin_url?: string | null
          email?: string | null
          status?: string
          date_contacted?: string | null
          last_activity?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          assigned_to?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          holding_company?: string | null
          brand_name?: string
          venue_type?: string | null
          area?: string | null
          priority?: string | null
          contact_name?: string | null
          contact_title?: string | null
          linkedin_url?: string | null
          email?: string | null
          status?: string
          date_contacted?: string | null
          last_activity?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          assigned_to?: string | null
        }
        Relationships: [
        ]
      }
      venues: {
        Row: {
          id: string
          name: string
          address: string | null
          type: string | null
          capacity: number | null
          contact_name: string | null
          notes: string | null
          genres: string[] | null
          created_at: string | null
          contact_phone: string | null
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          type?: string | null
          capacity?: number | null
          contact_name?: string | null
          notes?: string | null
          genres?: string[] | null
          created_at?: string | null
          contact_phone?: string | null
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          type?: string | null
          capacity?: number | null
          contact_name?: string | null
          notes?: string | null
          genres?: string[] | null
          created_at?: string | null
          contact_phone?: string | null
        }
        Relationships: [
        ]
      }
    }
    Views: {
      artist_booking_view: {
        Row: {
          id: string | null
          event_name: string | null
          starts_at: string | null
          ends_at: string | null
          fee_artist: number | null
          dress_code: string | null
          brief_text: string | null
          brief_doc_url: string | null
          brag_status: string | null
          venue_name: string | null
          venue_address: string | null
          contact_number: string | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
