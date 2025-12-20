import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

@ObjectType()
export class Shift {
  @Field(() => ID)
  id: string;

  @Field()
  startDate: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field()
  startTime: string; // "08:00", "14:00", etc.

  @Field({ nullable: true })
  endTime?: string; // "14:00", "22:00", etc.

  @Field({ nullable: true })
  observations?: string;

  @Field()
  active: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => ID, { nullable: true })
  puntoVentaId?: string;
}

@ObjectType()
export class ShiftListResponse {
  @Field(() => [Shift])
  shifts: Shift[];

  @Field()
  total: number;

  @Field()
  page: number;

  @Field()
  limit: number;
} 