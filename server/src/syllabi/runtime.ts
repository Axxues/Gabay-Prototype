import { prisma } from '../db.js';
import { PrismaSyllabusRepository } from './repository.js';

let activeRepository: PrismaSyllabusRepository | null = null;

export function getRagSyllabusRepository(): PrismaSyllabusRepository {
  if (!activeRepository) {
    activeRepository = new PrismaSyllabusRepository(prisma);
  }
  return activeRepository;
}

export function setRagSyllabusRepositoryForTests(repository: PrismaSyllabusRepository | null): void {
  activeRepository = repository;
}
