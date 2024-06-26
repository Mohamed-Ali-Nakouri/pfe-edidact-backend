import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { jwtConstants } from '../../auth/jwtConstants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      const user = await this.verifyToken(token, jwtConstants.secret);

      if (!user || !user.roleName) {
        throw new UnauthorizedException('Invalid token');
      }

      const userRoles = Array.isArray(user.roleName)
        ? user.roleName
        : [user.roleName];
      const requiredRoles = roles.map((role: string) => role);

      const hasRequiredRole = requiredRoles.some((role: string) =>
        userRoles.includes(role),
      );

      if (!hasRequiredRole) {
        throw new UnauthorizedException('Insufficient permissions');
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException(
        'Invalid token or insufficient permissions',
      );
    }
  }

  private extractTokenFromRequest(request: any): string | null {
    const authorizationHeader = request.headers['authorization'];

    if (!authorizationHeader) {
      return null;
    }

    const [, token] = authorizationHeader.split(' ');

    return token || null;
  }

  private verifyToken(token: string, secretKey: string): Promise<any> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  }
}
