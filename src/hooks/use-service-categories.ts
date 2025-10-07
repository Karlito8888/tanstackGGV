// Service Categories CRUD hooks with mobile-first optimizations
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/query-keys'
import { createCRUDHooks } from '../lib/crud/create-crud-hooks'
import type { Row } from '../lib/database-types'

type ServiceCategories = Row<'service_categories'>

// Create CRUD hooks for service_categories table
const serviceCategoriesHooks = createCRUDHooks<'service_categories'>({
  tableName: 'service_categories',
  queryKeys: {
    all: queryKeys.serviceCategories.all,
    lists: () => queryKeys.serviceCategories.lists(),
    list: (filters?: any) => queryKeys.serviceCategories.list(filters),
    details: () => queryKeys.serviceCategories.details(),
    detail: (id: string) => queryKeys.serviceCategories.detail(id),
  },
})

// Export basic CRUD hooks (users can only read and create per RLS policies)
export const useServiceCategoriesList = serviceCategoriesHooks.useList
export const useServiceCategoriesById = serviceCategoriesHooks.useById
export const useCreateServiceCategories = serviceCategoriesHooks.useCreate

// Note: Update and delete operations are not exported as they are not allowed by RLS policies
// Only authenticated users can create, everyone can read

// Service Categories queries with mobile-first optimizations
export function useServiceCategories(id?: string) {
  return useQuery({
    queryKey: id
      ? queryKeys.serviceCategories.detail(id)
      : ['service-categories', 'detail', ''],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes for individual category
  })
}

export function useServiceCategoriesListWithCount() {
  return useQuery({
    queryKey: queryKeys.serviceCategories.lists(),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('service_categories')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      return { data, count }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for categories lists
  })
}

export function useActiveServiceCategories() {
  return useQuery({
    queryKey: queryKeys.serviceCategories.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Array<ServiceCategories>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for active categories
  })
}

export function useSearchServiceCategories(searchQuery: string) {
  return useQuery({
    queryKey: queryKeys.serviceCategories.search(searchQuery),
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return []

      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .order('name', { ascending: true })
        .limit(50) // Limit search results

      if (error) throw error
      return data as Array<ServiceCategories>
    },
    enabled: !!searchQuery && searchQuery.length >= 2,
    staleTime: 3 * 60 * 1000, // 3 minutes for search results
  })
}

// Note: Admin operations (update, delete, bulk operations) are handled directly in Supabase
// Users can only read and create categories
