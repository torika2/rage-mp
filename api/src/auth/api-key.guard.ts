import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Only requests carrying the shared secret as `Authorization: Bearer <API_KEY>`
 * are allowed. This stops anyone but the game server from writing player data.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const expected = this.config.get<string>('API_KEY');

    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
