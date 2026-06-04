import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Helper para construir el body de una request GraphQL
export function gql(query: string, variables?: Record<string, unknown>) {
  return { query, variables };
}

export async function resetDatabase(app: INestApplication) {
  const dataSource = app.get(DataSource);
  await dataSource.query(
    'TRUNCATE TABLE "users_courses", "courses", "users" RESTART IDENTITY CASCADE',
  );
}
