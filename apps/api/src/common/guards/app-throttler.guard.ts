import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getErrorMessage(context: ExecutionContext): Promise<string> {
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const isLogin = request.url?.includes('/auth/login') ?? false;
    return Promise.resolve(
      isLogin
        ? 'Çok sayıda deneme yaptınız, lütfen bekleyiniz.'
        : 'İstek sınırını geçtiniz, lütfen bekleyiniz.',
    );
  }
}
