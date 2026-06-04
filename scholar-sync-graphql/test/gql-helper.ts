// Helper para construir el body de una request GraphQL 
export function gql(query: string, variables?: Record<string, unknown>) {
  return { query, variables };
}
