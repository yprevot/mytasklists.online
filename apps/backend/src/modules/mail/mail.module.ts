import { MailOutboxService } from './mail-outbox.service';
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService, MailOutboxService],
  exports: [MailService, MailOutboxService],
})
export class MailModule {}
