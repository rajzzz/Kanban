import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: {
        organization: {
          name: 'asc',
        },
      },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }
}
