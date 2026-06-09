import { Module } from '@nestjs/common';
import { TaskGateway } from './task.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  providers: [TaskGateway],
  exports: [TaskGateway],
})
export class WebsocketModule {}
