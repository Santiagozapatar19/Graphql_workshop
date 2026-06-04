import { Mutation, Resolver } from '@nestjs/graphql';
import { SeedService } from './seed.service';

@Resolver()
export class SeedResolver {
  constructor(private readonly seedService: SeedService) {}

  @Mutation(() => String, { name: 'executeSeed' })
  executeSeed(): Promise<string> {
    return this.seedService.runSeed();
  }
}
