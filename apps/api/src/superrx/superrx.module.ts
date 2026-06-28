import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SuperRxController } from './superrx.controller';
import { SuperRxService } from './superrx.service';

@Module({
  imports: [ConfigModule],
  controllers: [SuperRxController],
  providers: [SuperRxService],
})
export class SuperRxModule {}
