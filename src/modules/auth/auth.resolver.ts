import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { AuthResponse } from './dto/auth-response.output';
import { LoginResponse } from './dto/login-response.output';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Mutation(() => LoginResponse)
  async login(@Args('loginInput') loginInput: LoginInput): Promise<LoginResponse> {
    return this.authService.login(loginInput);
  }

  @Mutation(() => AuthResponse)
  async loginWithContext(
    @Args('loginInput') loginInput: LoginInput,
    @Context() context: any,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(loginInput);
    
    if (context.res) {
      const tokenExpiration = this.configService.get<string>('JWT_EXPIRES_IN') || '5m';
      const maxAge = this.parseExpirationToMilliseconds(tokenExpiration);
      
      context.res.cookie('access_token', result.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge,
      });
    }
    
    return result;
  }

  private parseExpirationToMilliseconds(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1), 10);
    
    const multipliers: { [key: string]: number } = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
    };
    
    return value * (multipliers[unit] || 60 * 1000);
  }

  @Mutation(() => Boolean)
  async logout(@Context() context: any): Promise<boolean> {
    if (context.res) {
      context.res.clearCookie('access_token');
    }
    return true;
  }
} 