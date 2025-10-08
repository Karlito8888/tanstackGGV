// Re-export from the auto-generated Supabase types
// This maintains backward compatibility while using the official format
import type { Database as Db } from '../../types/database'

export type { Database, Json } from '../../types/database'

// Helper types for backward compatibility
export type TableName = keyof Db['public']['Tables']
export type Row<T extends TableName> = Db['public']['Tables'][T]['Row']
export type InsertRow<T extends TableName> = Db['public']['Tables'][T]['Insert']
export type UpdateRow<T extends TableName> = Db['public']['Tables'][T]['Update']

// Additional helper types for common use cases
export type Profile = Db['public']['Tables']['profiles']['Row']
export type Location = Db['public']['Tables']['locations']['Row']
export type ChatMessage = Db['public']['Tables']['chat']['Row']
export type PrivateMessage = Db['public']['Tables']['private_messages']['Row']
export type Forum = Db['public']['Tables']['forums']['Row']
export type Thread = Db['public']['Tables']['threads']['Row']
export type MarketplaceListing =
  Db['public']['Tables']['marketplace_listings']['Row']
export type UserBusinessInside =
  Db['public']['Tables']['user_business_inside']['Row']
export type UserBusinessOutside =
  Db['public']['Tables']['user_business_outside']['Row']
export type UserService = Db['public']['Tables']['user_services']['Row']
