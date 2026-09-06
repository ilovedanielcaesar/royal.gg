export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          group_id: string;
          profile_id: string | null;
          name: string;
          display_name: string | null;
          is_guest: boolean;
          user_id: string | null;
          username: string | null;
          status: "pending" | "active" | "rejected";
          chosen_suit: "spade" | "heart" | "diamond" | "club" | null;
          chosen_rank:
            | "A"
            | "K"
            | "Q"
            | "J"
            | "10"
            | "9"
            | "8"
            | "7"
            | "6"
            | "5"
            | "4"
            | "3"
            | "2"
            | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          /** Defaults to the oldest group via default_group_id() until 0009. */
          group_id?: string;
          profile_id?: string | null;
          name: string;
          display_name?: string | null;
          is_guest?: boolean;
          user_id?: string | null;
          username?: string | null;
          status?: "pending" | "active" | "rejected";
          chosen_suit?: "spade" | "heart" | "diamond" | "club" | null;
          chosen_rank?:
            | "A"
            | "K"
            | "Q"
            | "J"
            | "10"
            | "9"
            | "8"
            | "7"
            | "6"
            | "5"
            | "4"
            | "3"
            | "2"
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          group_id: string;
          status: "draft" | "submitted" | "approved";
          created_by: string | null;
          submitted_at: string | null;
          submitted_by: string | null;
          approved_at: string | null;
          approved_by: string | null;
          review_note: string | null;
          played_at: string;
          notes: string | null;
          reconciled: boolean;
          discrepancy_cents: number;
          needs_review: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id?: string;
          status?: "draft" | "submitted" | "approved";
          created_by?: string | null;
          submitted_at?: string | null;
          submitted_by?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          review_note?: string | null;
          played_at: string;
          notes?: string | null;
          reconciled?: boolean;
          discrepancy_cents?: number;
          needs_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [];
      };
      buy_ins: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          amount_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          amount_cents?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["buy_ins"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "buy_ins_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buy_ins_player_id_fkey";
            columns: ["player_id"];
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      cash_outs: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          reported_amount_cents: number;
          adjusted_amount_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          reported_amount_cents: number;
          adjusted_amount_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cash_outs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "cash_outs_session_id_fkey";
            columns: ["session_id"];
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_outs_player_id_fkey";
            columns: ["player_id"];
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      payouts: {
        Row: {
          id: string;
          group_id: string;
          period_end_date: string;
          distributor_player_id: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id?: string;
          period_end_date: string;
          distributor_player_id: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payouts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payouts_distributor_player_id_fkey";
            columns: ["distributor_player_id"];
            referencedRelation: "players";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          /** Display handle, not a login credential. Null until they pick one. */
          username: string | null;
          display_name: string;
          is_app_owner: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name: string;
          is_app_owner?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          slug: string;
          join_code: string;
          join_policy: "code" | "code_approve";
          default_buy_in_cents: number;
          reconcile_threshold_cents: number;
          stakes_label: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          join_code: string;
          join_policy?: "code" | "code_approve";
          default_buy_in_cents?: number;
          reconcile_threshold_cents?: number;
          stakes_label?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Insert"]>;
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          profile_id: string;
          role: "admin" | "member";
          status: "pending" | "active" | "rejected" | "removed";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          profile_id: string;
          role?: "admin" | "member";
          status?: "pending" | "active" | "rejected" | "removed";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_members"]["Insert"]>;
        Relationships: [];
      };
      group_invites: {
        Row: {
          id: string;
          group_id: string;
          token: string;
          expires_at: string | null;
          max_uses: number | null;
          used_count: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          token: string;
          expires_at?: string | null;
          max_uses?: number | null;
          used_count?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_invites"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
