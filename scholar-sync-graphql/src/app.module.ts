import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { SeedModule } from './seed/seed.module';

import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      playground: true,
      introspection: true,
      csrfPrevention: false,
      context: ({ req }) => ({ req }),
    }),

    // TypeORM — usa las mismas variables de entorno que el profe
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST ?? 'localhost',
      port: process.env.DB_PORT ? +process.env.DB_PORT : 5432,
      database: process.env.DB_NAME ?? 'scholar_sync_graphql',
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      autoLoadEntities: true,
      synchronize: true,
      retryAttempts: process.env.NODE_ENV === 'test' ? 3 : 10,
      retryDelay: process.env.NODE_ENV === 'test' ? 1000 : 3000,
      ssl: process.env.DATABASE_URL
        ? { rejectUnauthorized: false }
        : false,
    }),

    UsersModule,
    CoursesModule,
    SeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
