import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserType, Gender } from './user.entity';
import { Character } from '../characters/character.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /** Create the account and its first character atomically. */
  async register(dto: RegisterDto): Promise<User> {
    await this.assertUnique(dto);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, {
          email: dto.email,
          passwordHash,
          residentNumber: dto.residentNumber,
          socialClubName: dto.socialClubName,
          phoneNumber: dto.phoneNumber ?? null,
          ipAddress: dto.ipAddress ?? null,
        }),
      );

      await manager.save(
        manager.create(Character, {
          userId: user.id,
          firstName: dto.firstName,
          lastName: dto.lastName,
          // gender starts null — chosen via the in-game chooser after login.
        }),
      );

      // Re-fetch with characters, without the password hash.
      return manager.findOneOrFail(User, { where: { id: user.id }, relations: { characters: true } });
    });
  }

  /** Verify email + password, return the account with its characters. */
  async login(dto: LoginDto): Promise<User> {
    return this.verifyAndLoad({ email: dto.email }, dto.password, 'Invalid email or password');
  }

  /** Verify social-club + password (the in-game flow: SC name comes from the server). */
  async loginBySocialClub(socialClubName: string, password: string): Promise<User> {
    return this.verifyAndLoad({ socialClubName }, password, 'Invalid Social Club or password');
  }

  /** Find by social-club name, or null — lets the connect handler pick login vs register. */
  findBySocialClub(socialClubName: string): Promise<User | null> {
    return this.users.findOne({ where: { socialClubName }, relations: { characters: true } });
  }

  private async verifyAndLoad(
    where: { email: string } | { socialClubName: string },
    password: string,
    failMessage: string,
  ): Promise<User> {
    const user = await this.users.findOne({ where, select: { id: true, passwordHash: true } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException(failMessage);
    }
    return this.findOne(user.id);
  }

  findOne(id: number): Promise<User> {
    return this.users.findOneOrFail({ where: { id }, relations: { characters: true } }).catch(() => {
      throw new NotFoundException(`User ${id} not found`);
    });
  }

  /** Set an account's email/phone verification flag. */
  async setValidation(id: number, field: 'isEmailValidated' | 'isPhoneValidated', value: boolean): Promise<User> {
    await this.findOne(id); // 404 if missing
    await this.users.update(id, { [field]: value });
    return this.findOne(id);
  }

  /** Promote/demote an account (admin / default / support). */
  async setType(id: number, userType: UserType): Promise<User> {
    await this.findOne(id); // 404 if missing
    await this.users.update(id, { userType });
    return this.findOne(id);
  }

  /** Set the account's gender and mirror it onto its characters (the body-driver). */
  async setGender(id: number, gender: Gender): Promise<User> {
    await this.findOne(id); // 404 if missing
    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, id, { gender });
      await manager.update(Character, { userId: id }, { gender });
    });
    return this.findOne(id);
  }

  private async assertUnique(dto: RegisterDto): Promise<void> {
    const clashes = await this.users.find({
      where: [
        { email: dto.email },
        { residentNumber: dto.residentNumber },
        { socialClubName: dto.socialClubName },
        ...(dto.phoneNumber ? [{ phoneNumber: dto.phoneNumber }] : []),
      ],
      select: { email: true, residentNumber: true, socialClubName: true, phoneNumber: true },
    });
    for (const clash of clashes) {
      if (clash.email === dto.email) throw new ConflictException('Email already registered');
      if (clash.residentNumber === dto.residentNumber) throw new ConflictException('Resident number already registered');
      if (clash.socialClubName === dto.socialClubName) throw new ConflictException('Social Club account already registered');
      if (dto.phoneNumber && clash.phoneNumber === dto.phoneNumber) throw new ConflictException('Phone number already registered');
    }
  }
}
