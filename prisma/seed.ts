import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { NodePasswordHasher } from '../src/modules/auth/infrastructure/node-password-hasher.js';

function requireEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function seed(): Promise<void> {
  const databaseUrl = requireEnvironmentValue('DATABASE_URL');
  const email = requireEnvironmentValue('INITIAL_ADMIN_EMAIL').toLowerCase();
  const fullName = requireEnvironmentValue('INITIAL_ADMIN_NAME');
  const password = requireEnvironmentValue('INITIAL_ADMIN_PASSWORD');
  if (password.length < 15) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 15 characters.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, max: 1 }),
  });

  try {
    const existingAdministrator = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingAdministrator !== null) {
      process.stdout.write(`Initial administrator already exists: ${email}\n`);
      return;
    }

    const passwordHash = await new NodePasswordHasher().hash(password);
    await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: 'ADMIN',
      },
    });
    process.stdout.write(`Initial administrator created: ${email}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

await seed();
