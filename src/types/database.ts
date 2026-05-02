export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
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
          period_end_date: string;
          distributor_player_id: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      get_email_by_username: {
        Args: { uname: string };
        Returns: string | null;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_active_user: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
