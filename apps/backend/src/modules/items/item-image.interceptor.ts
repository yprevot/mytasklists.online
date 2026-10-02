import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { ItemImageAccessService } from './item-image-access.service';

@Injectable()
export class ItemImageInterceptor implements NestInterceptor {
  constructor(private readonly access: ItemImageAccessService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const user = context.getType() === 'http' ? context.switchToHttp().getRequest().user : undefined;
    if (!user) return next.handle();
    const visit = (value: any): any => {
      if (Array.isArray(value)) return value.map(visit);
      if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
      const result: any = {};
      for (const [key, child] of Object.entries(value)) result[key] = visit(child);
      if (typeof result.imageUrl === 'string') {
        const match = /^\/items\/images\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/.exec(result.imageUrl);
        if (match) result.imageUrl = this.access.sign(match[1], user);
      }
      return result;
    };
    return next.handle().pipe(map(visit));
  }
}
