import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email address already exists');
    }

    // Hash the password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Set default organization name if not provided
    const organizationName = dto.organizationName?.trim() || `${dto.firstName || 'My'} Organization`;

    const { user } = await this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
        },
      });

      // 2. Create User
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
        },
      });

      // 3. Link user to organization as OWNER
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          role: 'OWNER',
        },
      });

      // 4. Create default Workspace
      const workspace = await tx.workspace.create({
        data: {
          name: 'Default Workspace',
          organizationId: organization.id,
        },
      });

      // 5. Link user to workspace as OWNER
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: createdUser.id,
          role: 'OWNER',
        },
      });

      return { user: createdUser };
    });

    // Omit passwordHash from the response payload
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }
}
