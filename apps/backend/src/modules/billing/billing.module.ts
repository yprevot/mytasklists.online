import { Global, Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StoreBillingService } from './store-billing.service';
import { DistributionController } from './distribution.controller';
@Global() @Module({providers:[BillingService,StoreBillingService],controllers:[BillingController,DistributionController],exports:[BillingService]})
export class BillingModule {}
